import json
import boto3
import urllib.request
import os

code_pipeline = boto3.client('codepipeline')

def handler(event, context):
    job_id = event['CodePipeline.job']['id']

    url = os.environ['waitHandleUrl']
    headers = { "Content-Type": "" }
    data = { "Status": "SUCCESS", "Reason": "Compilation Succeeded", "UniqueId": "KinesisAnalyticsBuildProject", "Data": "Compilation Succeeded" }

    try:
        req = urllib.request.Request(url, headers=headers, data=bytes(json.dumps(data), encoding="utf-8"), method='PUT')
        response = urllib.request.urlopen(req)

        code_pipeline.put_job_success_result(jobId=job_id)
    except Exception as e:
        print("failure: " + str(e))
        code_pipeline.put_job_failure_result(jobId=job_id, failureDetails={'message': str(e), 'type': 'JobFailed'})