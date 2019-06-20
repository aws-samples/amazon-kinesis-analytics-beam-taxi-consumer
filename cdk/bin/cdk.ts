#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import { CdkStack } from '../lib/cdk-stack';

const app = new cdk.App();

new CdkStack(app, 'BeamBuild', {  
    env: {
        region: "us-west-2"
    },
    build: true
});

new CdkStack(app, 'BeamTaxiCount', {  
    env: {
        region: "eu-west-1"
    },
    infrastructure: true
});