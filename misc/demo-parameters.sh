#!/bin/bash

echo "# Beam demo"
echo "## Kinesis Streams"

aws --region eu-west-1 cloudformation describe-stack-resources --stack-name BeamTaxiCount --query 'StackResources[? starts_with(LogicalResourceId,`EnrichEventsLambda`) && ResourceType == `AWS::Lambda::Function`]'.PhysicalResourceId --output text
aws --region eu-west-1 cloudformation describe-stack-resources --stack-name BeamTaxiCount --query 'StackResources[? starts_with(LogicalResourceId,`Bucket`)]'.PhysicalResourceId --output text
echo "kinesis-stream-data/"
aws --region eu-west-1 cloudformation describe-stacks --stack BeamTaxiCount --query 'Stacks[].Outputs[? starts_with(OutputKey,`KinesisReplayInfrastructureKinesisReplayInstance`)].OutputValue' --output text
aws --region eu-west-1 cloudformation describe-stacks --stack BeamTaxiCount --query 'Stacks[].Outputs[? starts_with(OutputKey,`KinesisReplayInfrastructureKinesisReplayCopyCommand`)].OutputValue' --output text
aws --region eu-west-1 cloudformation describe-stacks --stack BeamTaxiCount --query 'Stacks[].Outputs[? starts_with(OutputKey,`BeamReplay`)].OutputValue' --output text

echo
echo "## Kinesis Analytics"


echo "kinesis-analytics-full-access"
aws --region us-west-2 cloudformation describe-stacks --stack BeamBuild --query 'Stacks[].Outputs[? starts_with(OutputKey,`S3Bucket`)].OutputValue' --output text
echo "target/beam-taxi-count-1.0-SNAPSHOT.jar"
echo "BeamApplicationProperties"
echo "InputStreamName"
echo "OutputBoroughs"

echo
echo "## EMR"

aws --region eu-west-1 cloudformation describe-stacks --stack BeamTaxiCount --query 'Stacks[].Outputs[? starts_with(OutputKey,`EmrInfrastructureSshEmrClusterEC3E33DC`)].OutputValue' --output text
aws --region eu-west-1 cloudformation describe-stacks --stack BeamTaxiCount --query 'Stacks[].Outputs[? starts_with(OutputKey,`EmrInfrastructureStartFlinkRuntime`)].OutputValue' --output text
aws --region us-west-2 cloudformation describe-stacks --stack BeamBuild --query 'Stacks[].Outputs[? starts_with(OutputKey,`BuildPipelineBeamTaxiCountCopyCommand`)].OutputValue' --output text
aws --region eu-west-1 cloudformation describe-stacks --stack BeamTaxiCount --query 'Stacks[].Outputs[? starts_with(OutputKey,`StartFlinkApplication`)].OutputValue' --output text
