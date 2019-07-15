#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { CdkStack } from '../lib/cdk-stack';

const app = new cdk.App();

new CdkStack(app, 'BeamTaxiCount-Build', {
    build: true
});

new CdkStack(app, 'BeamTaxiCount-Demo', {
    demoInfrastructure: true
});

new CdkStack(app, 'BeamTaxiCount-Complete', {
    completeInfrastructure: true
});