import cdk = require('@aws-cdk/core');
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import emr = require('@aws-cdk/aws-emr');
import ec2 = require('@aws-cdk/aws-ec2');

export interface EmrProps {
    bucket: s3.Bucket,
    keyName: string,
    region: string,
    vpc: ec2.Vpc
}
  
export class EmrInfrastructure extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: EmrProps) {
        super(scope, id);

        const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
            vpc: props.vpc
        });

        sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

        const role = new iam.Role(this, 'ReplayRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonElasticMapReduceforEC2Role')
            ]
        });

        const profile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
            roles: [
                role.roleName
            ]
        });

        const cluster = new emr.CfnCluster(this, 'EmrCluster', {
            name: 'Beam',
            applications: [
                { name: 'Hadoop' }, 
                { name: 'Ganglia' }, 
                { name: 'Flink' }, 
                { name: 'ZooKeeper'}
            ],
            instances: {
                masterInstanceGroup: {
                    instanceCount: 1,
                    instanceType: 'c5.xlarge',
                    name: 'Master'
                },
                coreInstanceGroup: {
                    instanceCount: 2,
                    instanceType: 'r5.xlarge',
                    name: 'Core'
                },
                ec2KeyName: props.keyName,
                additionalMasterSecurityGroups: [
                    sg.securityGroupName
                ],
                ec2SubnetId: props.vpc.publicSubnets[0].subnetId
            },
            serviceRole : 'EMR_DefaultRole',
            releaseLabel: 'emr-5.20.0',
            visibleToAllUsers: true,
            jobFlowRole: profile.ref,
            configurations: [
                {
                    classification: 'emrfs-site',
                    configurationProperties: {
                        "fs.s3.maxConnections": "1000"
                    }
                }
            ]
        });

        new cdk.CfnOutput(this, 'SshEmrCluster', { value: `ssh -C -D 8157 hadoop@${cluster.attrMasterPublicDns}` });
        new cdk.CfnOutput(this, 'StartFlinkRuntime', { value: 'flink-yarn-session -n 2 -s 4 -tm 16GB -d' });
    }
}