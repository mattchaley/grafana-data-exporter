import { queryByMetric, Datasource, Metric } from 'grafana-datasource-kit';
import { apiKeys } from './config';

import * as csv from 'fast-csv';
import * as path from 'path';
import * as fs from 'fs';
import * as moment from 'moment';
import { URL } from 'url';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export class Target {
  private exportedRows: number;
  private days: number;
  private day: number;
  private csvStream: any;
  private metric: Metric;
  private createdTimestamp: number; 

  constructor(
    private panelUrl: string,
    private user: string,
    datasource: Datasource,
    targets: Array<Object>,
    private from: number,
    private to: number,
    private datasourceName: string,
  ) {
    this.metric = new Metric(datasource, targets);
  }
  

  public updateStatus(status) {
    let time = moment().valueOf();
    let data = {
      time,
      user: this.user,
      exportedRows: this.exportedRows,
      progress: (this.day / this.days).toLocaleString('en', { style: 'percent' }),
      status,
      datasourceName: this.datasourceName
    };
    return new Promise((resolve, reject) => {
      fs.writeFile(this.getFilePath('json'), JSON.stringify(data), 'utf8', err => {
        if(err) {
          console.error(err);
          reject('Can`t write file');
        } else {
          resolve();
        }
      });
    });
  }

  public async export() {
    this.exportedRows = 0;
    this.days = Math.ceil((this.to - this.from) / MS_IN_DAY);
    this.day = 0;
    this.initCsvStream();

    let to = this.to;
    let from = this.from;

    console.log(`Total days: ${this.days}`);
    while(this.day < this.days) {
      this.day++;
      to = from + MS_IN_DAY;

      console.log(`${this.day} day: ${from}ms -> ${to}ms`);

      let host = new URL(this.panelUrl).origin;
      let apiKey = apiKeys[host];

      if(apiKey === undefined || apiKey === '') {
        throw new Error(`Please configure API key for ${host}`);
      }
      let metrics = await queryByMetric(this.metric, this.panelUrl, from, to, apiKey);

      if(metrics.values.length > 0) {
        if(metrics !== undefined) {
          this.writeCsv(metrics);
        }
      }
      await this.updateStatus('exporting');

      from += MS_IN_DAY;
    }
    this.csvStream.end();
  }
  // TODO: move csv-related stuff to service
  private initCsvStream() {
    this.csvStream = csv.createWriteStream({ headers: true });
    let writableStream = fs.createWriteStream(this.getFilePath('csv'));

    this.csvStream.pipe(writableStream);
    writableStream.on('finish', async () => {
      console.log(`Everything is written to ${this.getFilename('csv')}`);
      await this.updateStatus('finished');
    })
  }

  private writeCsv(series) {
    for(let val of series.values) {
      if(val[1] !== null) {
        let row = {};
        for(let col in series.columns) {
          row[series.columns[col]] = val[col];
        }
        this.csvStream.write(row);
        this.exportedRows++;
      }
    }
  }

  private getFilename(extension) {
    if(this.createdTimestamp === undefined) {
      this.createdTimestamp = moment().valueOf();
    }
    return `${this.createdTimestamp}.${this.datasourceName}.${extension}`;
  }

  private getFilePath(extension) {
    let filename = this.getFilename(extension);
    return path.join(__dirname, `../exported/${filename}`);
  }

}
