import cdk = require('@aws-cdk/core');
import codeguruprofiler = require('@aws-cdk/aws-codeguruprofiler');
import iam = require('@aws-cdk/aws-iam');

export interface CodeGuruProfilerProps {
    groupName: string,
    role: iam.Role
}

export class CodeGuruProfilerInfrastructure extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: CodeGuruProfilerProps) {
        super(scope, id);

        const profilingGroup = new codeguruprofiler.ProfilingGroup(this, 'MyProfilingGroup', {
            profilingGroupName: props.groupName,
            computePlatform: codeguruprofiler.ComputePlatform.DEFAULT,
        });
        profilingGroup.grantPublish(props.role);

        new cdk.CfnOutput(this, 'CodeGuruProfilingGroup', { value: profilingGroup.profilingGroupArn });
    }
}