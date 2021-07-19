/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

package com.amazonaws.samples.beam.taxi.count;

import com.amazonaws.samples.beam.taxi.count.kinesis.Event;
import com.amazonaws.samples.beam.taxi.count.kinesis.TripEvent;
import org.apache.beam.sdk.io.kinesis.KinesisRecord;
import org.apache.beam.sdk.transforms.DoFn;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static com.amazonaws.samples.beam.taxi.count.kinesis.Event.parseEvent;

public class EventParser {
  private static final Logger LOG = LoggerFactory.getLogger(EventParser.class);

  public static class KinesisParser extends DoFn<KinesisRecord, TripEvent> {
    @ProcessElement
    public void processElement(@Element KinesisRecord record, OutputReceiver<TripEvent> out) {
      try {
        Event event = parseEvent(record.getDataAsBytes());

        if (TripEvent.class.isAssignableFrom(event.getClass())) {
          TripEvent trip = (TripEvent) event;

          out.output(trip);
        }
      } catch (Exception e) {
        //just ignore the event
        LOG.warn("failed to parse event: {}", e.getLocalizedMessage());
      }
    }
  }

  public static class S3Parser extends DoFn<String, TripEvent> {
    @ProcessElement
    public void processElement(@Element String record, OutputReceiver<TripEvent> out) {
      try {
        Event event = parseEvent(record);

        if (TripEvent.class.isAssignableFrom(event.getClass())) {
          TripEvent trip = (TripEvent) event;

          out.outputWithTimestamp(trip, trip.getTimestamp());
        }
      } catch (Exception e) {
        //just ignore the event
        LOG.warn("failed to parse event: {}", e.getLocalizedMessage());
      }
    }
  }
}
