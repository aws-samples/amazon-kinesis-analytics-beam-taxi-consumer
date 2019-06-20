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

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

public class Metric implements Serializable {
  public final long count;
  public final String borough;
  public final Instant timestamp;

  public Metric() {
    count = 0;
    borough = "";
    timestamp = Instant.EPOCH;
  }

  public Metric(long count, org.joda.time.Instant timestamp) {
    this.count = count;
    this.borough = null;
    this.timestamp = Instant.ofEpochMilli(timestamp.getMillis());
  }


  public Metric(long count, String borough, org.joda.time.Instant timestamp) {
    this.count = count;
    this.borough = borough;
    this.timestamp = Instant.ofEpochMilli(timestamp.getMillis());
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    Metric metric = (Metric) o;
    return count == metric.count &&
        Objects.equals(timestamp, metric.timestamp);
  }

  @Override
  public int hashCode() {
    return Objects.hash(count, timestamp);
  }

  @Override
  public String toString() {
    return "Metric{" +
        "count=" + count +
        ", borough='" + borough + '\'' +
        ", timestamp=" + timestamp +
        '}';
  }
}
