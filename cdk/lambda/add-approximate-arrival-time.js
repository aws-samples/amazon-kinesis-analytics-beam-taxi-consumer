'use strict';
console.log('Loading function');

exports.handler = (event, context, callback) => {
    /* Process the list of records and transform them */
    const output = event.records.map((record) => ({
        recordId: record.recordId,
        result: 'Ok',
        data: enrichPayload(record),
    }));
    
    console.log(`Processing completed.  Successful records ${output.length}.`);
    
    callback(null, { records: output });
};


function enrichPayload(record) {
    const payload = JSON.parse(Buffer.from(record.data, 'base64').toString('utf8'));
    const timestamp = new Date(record.kinesisRecordMetadata.approximateArrivalTimestamp).toISOString();
    
    const enrichedPayload = Object.assign({approximate_arrival_timestamp: timestamp}, payload);

    return Buffer.from(JSON.stringify(enrichedPayload)+"\n").toString('base64');
}