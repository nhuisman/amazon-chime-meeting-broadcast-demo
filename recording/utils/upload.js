// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const AWS = require('aws-sdk');

/**
 * S3Upload Class
 * Upload a recording artifact to S3
 */
class S3Uploader {
    /**
     * @constructor
     * @param {*} bucket - the S3 bucket name uploaded to
     * @param {*} key - the file name in S3 bucket
     */
    constructor(bucket, key) {


        this.bucket = bucket;
        this.key = key;
        AWS.config.update({region: 'us-east-1'});
        this.s3Uploader = new AWS.S3({ params: { Bucket: bucket, Key: key }});

	AWS.config.getCredentials(function(err) {
	  if (err) console.log(err.stack); // credentials not loaded
	  else console.log("Access Key:", AWS.config.credentials.accessKeyId);
	});

	// Create S3 service object
	let s3 = new AWS.S3({apiVersion: '2006-03-01'});

	// Call S3 to list the buckets
	s3.listBuckets(function(err, data) {
	  if (err) {
	    console.log("Error", err);
	  } else {
	    console.log("Success", data.Buckets);
	  }
	});

        console.log(`[upload process] This constructed a S3 object with bucket: ${this.bucket}, key: ${this.key}`);
    }

    uploadStream(stream) {
        const managedUpload = this.s3Uploader.upload({ Body: stream }, (err, data) => {
            if (err) {
                console.log(`[stream upload process] - failure - error handling on failure: ${err}`);
            } else {
                console.log(`[stream upload process] - success - uploaded the file to: ${data.Location}`);
                process.exit();
            }
        });
        managedUpload.on('httpUploadProgress', function (event) {
            console.log(`[stream upload process]: on httpUploadProgress ${event.loaded} bytes`);
        });
    }
}

module.exports = {
    S3Uploader
};
