import os
import boto3

client = boto3.client('kinesisanalyticsv2')

def empty_bucket(event, context):
    response = client.stop_application(
        ApplicationName=os.environ['application_name']
    )