#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { CdkStack } from '../lib/cdk-stack';

const app = new cdk.App();

const dependencies = {
    kinesisReplayVersion: 'release-0.1.0',
    consumerApplicationVersion: 'release-0.1.0',
    consumerApplicationJarObject: 'amazon-kinesis-analytics-beam-taxi-consumer-0.1.0.jar'
}


new CdkStack(app, 'BeamTaxiCount-Build', {
    ...dependencies,
    build: true,
});

new CdkStack(app, 'BeamTaxiCount-Demo', {
    ...dependencies,
    demoInfrastructure: true
});

new CdkStack(app, 'BeamTaxiCount-Complete', {
    ...dependencies,
    completeInfrastructure: true
});