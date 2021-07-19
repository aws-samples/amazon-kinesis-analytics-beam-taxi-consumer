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

package com.amazonaws.samples.beam.taxi.count.kinesis;

import org.apache.beam.sdk.coders.DefaultCoder;
import org.apache.beam.sdk.coders.SerializableCoder;
import org.joda.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;


@DefaultCoder(SerializableCoder.class)
public class TripEvent extends Event {
  public final long tripId;
  public final double totalAmount;
  public final int pickupLocationId;
  public final int dropoffLocationId;
  public final Instant pickupDatetime;
  public final Instant dropoffDatetime;
  public final Instant approximateArrivalTimestamp;

  private static final Logger LOG = LoggerFactory.getLogger(TripEvent.class);

  public TripEvent() {
    tripId = 0;
    pickupLocationId= 0;
    dropoffLocationId = 0;
    totalAmount = 0;
    pickupDatetime = new Instant(0L);
    dropoffDatetime = new Instant(0L);
    approximateArrivalTimestamp = new Instant(0L);
  }

  @Override
  public Instant getTimestamp() {
    return approximateArrivalTimestamp;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    TripEvent tripEvent = (TripEvent) o;
    return tripId == tripEvent.tripId;
  }

  @Override
  public int hashCode() {
    return Objects.hash(tripId);
  }

}
