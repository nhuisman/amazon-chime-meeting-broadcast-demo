if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const ACCESS_ID = process.env.ACCESS_ID;
const SECRET_KEY = process.env.SECRET_KEY;

const crypto = require('crypto');
const express = require('express');
const proxy = require('http-proxy-middleware');
const v4 = require('./lib/aws-signature-v4'); // to generate our pre-signed URL

let region = 'us-east-1';
let languageCode = 'en-US';
let sampleRate;

let proxyRouter = function (req) {
    return createPresignedUrl();
}

var proxyFilter = function(pathname, req) {
    return pathname.match('^/ws') && req.method === 'GET'
  }

let wsProxy = proxy(proxyFilter, {
    target: createPresignedUrl(),
    ws: true, // enable websocket proxy
    logLevel: 'debug',
    changeOrigin: true,
    pathRewrite: {
        '^/ws': '' // remove path.
    },

    router: proxyRouter, //generate a fresh pre-signed URL for each connection

    onError: function(err, req, res) {
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });
    
        res.end(err);
    }
});

const app = express();
app.use(express.static('public'));
app.use(wsProxy); // add the proxy to express

const server = app.listen(process.env.PORT || 5000);
server.on('upgrade', wsProxy.upgrade);

app.get('/', function (request, response) {
    response.sendFile(__dirname + '/index.html');
});

app.get('/stop', function (request, response) {});

app.get('/region/:region', function (request, response) {
    region = request.params.region;
    response.sendStatus(200);
});

app.get('/language/:languageCode', function (request, response) {
    languageCode = request.params.languageCode;
    
    if(languageCode=="en-US" || languageCode=="es-US")
        sampleRate = 44100
    else
        sampleRate = 8000;

    response.sendStatus(200);
});

function createPresignedUrl() {
    let query = "language-code=" + languageCode + "&media-encoding=pcm&sample-rate=" + sampleRate;

    let endpoint = "transcribestreaming." + region + ".amazonaws.com:8443";

    // get a preauthenticated URL that we can use to establish our WebSocket
    return v4.createPresignedURL(
        'GET',
        endpoint,
        '/stream-transcription-websocket',
        'transcribe',
        crypto.createHash('sha256').update('', 'utf8').digest('hex'), {
            'key': ACCESS_ID,
            'secret': SECRET_KEY,
            'protocol': 'wss',
            'expires': 15,
            'region': region,
            'query': query
        }
    );
}