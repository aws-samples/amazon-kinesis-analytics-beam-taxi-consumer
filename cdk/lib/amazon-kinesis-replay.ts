import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import cloudwatch = require('@aws-cdk/aws-cloudwatch')
import { AmazonLinuxGeneration } from '@aws-cdk/aws-ec2';
import { GithubBuildPipeline } from './github-build-pipeline';

export interface KinesisReplayProps {
  bucket: s3.Bucket,
  keyName: string,
  vpc: ec2.Vpc
}

export class KinesisReplay extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: KinesisReplayProps) {
    super(scope, id);

    new GithubBuildPipeline(this, 'KinesisReplayBuildPipeline', {
        bucket: props.bucket,
        url: 'https://github.com/aws-samples/amazon-kinesis-replay/archive/master.zip',
        extract: true
    });

    const replayCopyCommand = `aws s3 cp --recursive --exclude '*' --include 'amazon-kinesis-replay-*.jar' 's3://${props.bucket.bucketName}/target/' .`

    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
        vpc: props.vpc
    });

    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

    const ami = new ec2.AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2
    });

    const role = new iam.Role(this, 'ReplayRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
        ]
    });

    cloudwatch.Metric.grantPutMetricData(role);
    props.bucket.grantRead(role);

    role.addToPolicy(new iam.PolicyStatement({
        actions: ['kinesis:*'],
        resources: ['*']
    }));

    const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
        roles: [role.roleName]
    });

    const instance = new ec2.CfnInstance(this, 'ReplayInstance', {
        imageId: ami.getImage(this).imageId,
        monitoring: true,
        instanceType: 'c5.2xlarge',
        iamInstanceProfile: instanceProfile.ref,
        subnetId: props.vpc.publicSubnets[0].subnetId,
        securityGroupIds: [sg.securityGroupId],
        keyName: props.keyName,
        userData: cdk.Fn.base64(
            `#!/bin/bash -x
            
            yum update -y
            yum install -y tmux

            # install Java 11
            amazon-linux-extras enable java-openjdk11
            yum install -y java-11-openjdk

            # copy the replay Java app from s3
            su ec2-user -l -c "${replayCopyCommand}"`
        )
    });
    
    new cdk.CfnOutput(this, 'KinesisReplayInstance', { value: `ssh -C ec2-user@${instance.attrPublicDnsName}` });
  }
}