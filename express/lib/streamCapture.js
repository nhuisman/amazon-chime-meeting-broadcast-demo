const ffmpegStreamer = require('fluent-ffmpeg');

exports.ffmpeg_stream = function() {
    let command = ffmpegStreamer()
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

    return command.pipe();
};