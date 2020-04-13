## Amazon Transcribe Websocket Express

An express app that proxies a websocket connection from the browser to an authenticated WebSocket endpoint for [Amazon Transcribe](https://aws.amazon.com/transcribe/).

Check out the [Amazon Transcribe WebSocket docs](https://docs.aws.amazon.com/transcribe/latest/dg/websocket.html).

## Building and Deploying

1. Clone the repo
2. run `npm install`
3. run `npm run-script build` to generate `public/main.js`.

Once you've bundled the JavaScript, all you need is a webserver. For example, from your project directory: 

```
npm start
```

## License

This library is licensed under the Apache 2.0 License. 