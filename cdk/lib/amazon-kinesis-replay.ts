import cdk = require('@aws-cdk/cdk');
import s3 = require('@aws-cdk/aws-s3');
import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import cloudwatch = require('@aws-cdk/aws-cloudwatch')
import { Vpc, AmazonLinuxGeneration } from '@aws-cdk/aws-ec2';
import { CfnStack } from '@aws-cdk/aws-cloudformation';
import { Base64 } from 'js-base64';

export interface KinesisReplayProps {
  bucket: s3.Bucket,
  keyName: string
}

export class KinesisReplay extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: KinesisReplayProps) {
    super(scope, id);

    const replayBuildStack = new CfnStack(this, 'KinesisReplayBuild', {
        templateUrl: 'https://s3.amazonaws.com/aws-bigdata-blog/artifacts/kinesis-analytics-taxi-consumer/cfn-templates/kinesis-replay-build-pipeline.yml',
        parameters: {
            ExternalArtifactBucket: props.bucket.bucketName
        }
    });

    const kinesisReplayCopyCommand = replayBuildStack.getAtt('Outputs.KinesisReplayCopyCommand');

    const vpc = Vpc.fromLookup(this, 'VPC', {
        isDefault: true
    });

    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
        vpc: vpc
    });

    sg.addIngressRule(new ec2.AnyIPv4, new ec2.TcpPort(22));

    const ami = new ec2.AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AmazonLinux2
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
        iamInstanceProfile: instanceProfile.refAsString,
        networkInterfaces: [
            {
                deviceIndex: '0',
                associatePublicIpAddress: true,
                deleteOnTermination: true,
                groupSet: [sg.securityGroupId]
            }
        ],
        keyName: props.keyName,
        userData: Base64.encode(
            `#!/bin/bash -x
            
            yum update -y
            yum install -y tmux

            # install Java 11
            amazon-linux-extras enable java-openjdk11
            yum install -y java-11-openjdk

            # copy the replay Java app from s3
            # su ec2-user -l -c "${kinesisReplayCopyCommand}"`
        )
    });
    
    new cdk.CfnOutput(this, 'KinesisReplayInstance', { value: `ssh -C ec2-user@${instance.attrPublicDnsName}` });
    new cdk.CfnOutput(this, 'KinesisReplayCopyCommand', { value: `${kinesisReplayCopyCommand}` });
  }
}