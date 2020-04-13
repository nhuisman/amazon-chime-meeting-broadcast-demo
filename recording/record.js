// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const { spawn } = require('child_process');
const { S3Uploader } = require('./utils/upload');

const MEETING_URL = process.env.MEETING_URL || 'Not present in environment';
console.log(`[recording process] MEETING_URL: ${MEETING_URL}`);

const args = process.argv.slice(2);
const BUCKET_NAME = args[0];
console.log(`[recording process] BUCKET_NAME: ${BUCKET_NAME}`);
const BROWSER_SCREEN_WIDTH = args[1];
const BROWSER_SCREEN_HEIGHT = args[2];
console.log(`[recording process] BROWSER_SCREEN_WIDTH: ${BROWSER_SCREEN_WIDTH}, BROWSER_SCREEN_HEIGHT: ${BROWSER_SCREEN_HEIGHT}`);

const VIDEO_BITRATE = 3000;
const VIDEO_FRAMERATE = 30;
const VIDEO_GOP = VIDEO_FRAMERATE * 2;
const AUDIO_BITRATE = '160k';
const AUDIO_SAMPLERATE = 44100;
const AUDIO_CHANNELS = 2
const DISPLAY = process.env.DISPLAY;

const audioUtils = require('./audioUtils'); // for encoding audio data as PCM
const marshaller = require("@aws-sdk/eventstream-marshaller"); // for converting binary event stream messages to and from JSON
const util_utf8_node = require("@aws-sdk/util-utf8-node"); // utilities for encoding and decoding UTF8
const mic = require('microphone-stream'); // collect microphone input as a stream of raw bytes

// our converter between binary event streams messages and JSON
const eventStreamMarshaller = new marshaller.EventStreamMarshaller(util_utf8_node.toUtf8, util_utf8_node.fromUtf8);

// our global variables for managing state
let languageCode;
let region;
let sampleRate;
let transcription = "";
let socket;
let micStream;
let socketError = false;
let transcribeException = false;

var ffmpeg = require('fluent-ffmpeg');

var command = ffmpeg()
.addInput(':2.0+0,150')
.withSize('720x480')
.withFpsInput(30)
.withFpsOutput(30)
.addInputOptions('-y', '-f' , 'x11grab')
.format('mp4')
.outputOptions('-movflags frag_keyframe+empty_moov')
.on('end', function() {
   console.log('file has been converted succesfully');
})
.on('error', function(err) {
    console.log('an error happened: ' + err.message);
});

var ffstream = command.pipe();

ffstream.on('data', function(chunk) {
  console.log('ffmpeg just wrote ' + chunk.length + ' bytes');
});

const transcodeStreamToOutput = spawn('ffmpeg',[
    '-hide_banner',
    '-loglevel', 'error',
    // disable interaction via stdin
    '-nostdin',
    // screen image size
    '-s', `${BROWSER_SCREEN_WIDTH}x${BROWSER_SCREEN_HEIGHT}`,
    // video frame rate
    '-r', `${VIDEO_FRAMERATE}`,
    // hides the mouse cursor from the resulting video
    '-draw_mouse', '0',
    // grab the x11 display as video input
    '-f', 'x11grab',
        '-i', `${DISPLAY}`,
    // grab pulse as audio input
    '-f', 'pulse', 
        '-ac', '2',
        '-i', 'default',
    // codec video with libx264
    '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'main',
        '-preset', 'veryfast',
        '-x264opts', 'nal-hrd=cbr:no-scenecut',
        '-minrate', `${VIDEO_BITRATE}`,
        '-maxrate', `${VIDEO_BITRATE}`,
        '-g', `${VIDEO_GOP}`,
    // apply a fixed delay to the audio stream in order to synchronize it with the video stream
    '-filter_complex', 'adelay=delays=1000|1000',
    // codec audio with aac
    '-c:a', 'aac',
        '-b:a', `${AUDIO_BITRATE}`,
        '-ac', `${AUDIO_CHANNELS}`,
        '-ar', `${AUDIO_SAMPLERATE}`,
    // adjust fragmentation to prevent seeking(resolve issue: muxer does not support non seekable output)
    '-movflags', 'frag_keyframe+empty_moov',
    // set output format to mp4 and output file to stdout
    '-f', 'mp4', '-'
    ]
);

transcodeStreamToOutput.stderr.on('data', data => {
    console.log(`[transcodeStreamToOutput process] stderr: ${(new Date()).toISOString()} ffmpeg: ${data}`);
});

console.log(`[pid]: ${transcodeStreamToOutput.pid}`)

const timestamp = new Date();
const fileTimestamp = timestamp.toISOString().substring(0,19);
const year = timestamp.getFullYear();
const month = timestamp.getMonth() + 1;
const day = timestamp.getDate();
const hour = timestamp.getUTCHours();
const fileName = `${year}/${month}/${day}/${hour}/${fileTimestamp}.mp4`;
const uploader = new S3Uploader(BUCKET_NAME, fileName)
uploader.uploadStream(transcodeStreamToOutput.stdout);

// event handler for docker stop, not exit until upload completes
process.on('SIGTERM', (code, signal) => {
    console.log(`[recording process] exited with code ${code} and signal ${signal}(SIGTERM)`);
    process.kill(transcodeStreamToOutput.pid, 'SIGTERM');
});

// debug use - event handler for ctrl + c
process.on('SIGINT', (code, signal) => {
    console.log(`[recording process] exited with code ${code} and signal ${signal}(SIGINT)`)
    process.kill('SIGTERM');
});

process.on('exit', function(code) {
    console.log('[recording process] exit code', code);
});






/////  NEW STUFF


let streamAudioToWebSocket = function (userMediaStream) {
    //let's get the mic input from the browser, via the microphone-stream module
    micStream = new mic();
    micStream.setStream(userMediaStream);

    let url = window.location.href.replace("https://", "wss://")
    url = url.replace("http://", "ws://")
    url = url + 'ws';

    //open up our WebSocket connection
    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    // when we get audio data from the mic, send it to the WebSocket if possible
    socket.onopen = function () {
        micStream.on('data', function (rawAudioChunk) {
            // the audio stream is raw audio bytes. Transcribe expects PCM with additional metadata, encoded as binary
            let binary = convertAudioToBinaryMessage(rawAudioChunk);

            if (socket.OPEN)
                socket.send(binary);
        })
    };

    // handle messages, errors, and close events
    wireSocketEvents();
}

function wireSocketEvents() {
    // handle inbound messages from Amazon Transcribe
    socket.onmessage = function (message) {
        //convert the binary event stream message to JSON
        let messageWrapper = eventStreamMarshaller.unmarshall(Buffer(message.data));
        let messageBody = JSON.parse(String.fromCharCode.apply(String, messageWrapper.body));
        if (messageWrapper.headers[":message-type"].value === "event") {
            handleEventStreamMessage(messageBody);
        } else {
            transcribeException = true;
            showError(messageBody.Message);
            toggleStartStop();
        }
    };

    socket.onerror = function () {
        socketError = true;
        showError('WebSocket connection error. Try again.');
        toggleStartStop();
    };

    socket.onclose = function (closeEvent) {
        micStream.stop();

        // the close event immediately follows the error event; only handle one.
        if (!socketError && !transcribeException) {
            if (closeEvent.code != 1000) {
                showError('</i><strong>Streaming Exception</strong><br>' + closeEvent.reason);
            }
            toggleStartStop();
        }
    };
}

let handleEventStreamMessage = function (messageJson) {
    let results = messageJson.Transcript.Results;

    if (results.length > 0) {
        if (results[0].Alternatives.length > 0) {
            let transcript = results[0].Alternatives[0].Transcript;

            // fix encoding for accented characters
            transcript = decodeURIComponent(escape(transcript));

            // update the textarea with the latest result
            $('#transcript').val(transcription + transcript + "\n");

            // if this transcript segment is final, add it to the overall transcription
            if (!results[0].IsPartial) {
                //scroll the textarea down
                $('#transcript').scrollTop($('#transcript')[0].scrollHeight);

                transcription += transcript + "\n";
            }
        }
    }
}

let closeSocket = function () {
    if (socket.OPEN) {
        micStream.stop();

        // Send an empty frame so that Transcribe initiates a closure of the WebSocket after submitting all transcripts
        let emptyMessage = getAudioEventMessage(Buffer.from(new Buffer([])));
        let emptyBuffer = eventStreamMarshaller.marshall(emptyMessage);
        socket.send(emptyBuffer);
    }
}
