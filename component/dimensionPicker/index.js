import React from 'react';
import { Tabs, TabsItem, Spinner } from 'nr1';

import nrdbQuery from '../lib/nrdb-query';
import quote from '../lib/quote';
import { timePickerNrql } from './get-query';
import Attribute from './attribute';

export default class DimensionPicker extends React.Component {
  constructor(props) {
    super(props);
    console.log('props', props);
    this.state = {};
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.account !== this.props.account ||
      prevProps.attribute !== this.props.attribute ||
      prevProps.eventType !== this.props.eventType ||
      prevProps.filterWhere !== this.props.filterWhere
    ) {
      this.loadDimensions();
    }
  }

  getNrql(select) {
    const { filterWhere, eventType, attribute, entity } = this.props;
    const timeRange = timePickerNrql(this.props);

    let whereClause = ['true'];
    if (eventType == 'Metric') {
      whereClause.push(`metricName = '${attribute}'`);
    }
    if (entity && entity.domain == 'INFRA') {
      whereClause.push(`entityGuid = '${entity.guid}'`);
    } else if (entity) {
      whereClause.push(`appId = ${entity.applicationId}`);
    }
    if (filterWhere) whereClause.push(`${filterWhere}`);

    const nrql = `SELECT ${select} FROM ${quote(
      eventType
    )} WHERE ${whereClause.join(' AND ')} ${timeRange}`;
    return nrql;
  }

  async loadDimensions() {
    // const { account } = this.props;
    const accountId = this.props.entity.accountId;
    const dimensions = [];
    const attributes = [];

    this.setState({ dimensions: null });
    if (!this.props.eventType) return;

    // get all of the available string attributes
    let results = await nrdbQuery(accountId, this.getNrql('keySet()'));
    const keys = results
      .filter(d => d.type == 'string' && d.key !== 'metricName')
      .map(d => {
        return { name: d.key };
      });

    const BATCH_SIZE = 50;
    for (var i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);

      // get the # of unique values for each string attribute
      const select = batch.map(d => `uniqueCount(${quote(d.name)})`);
      results = await nrdbQuery(accountId, this.getNrql(select));
      batch.forEach(d => {
        d.count = results[0][`uniqueCount.${d.name}`];

        if (d.count == 1) attributes.push(d);
        if (d.count > 1) dimensions.push(d);
      });
    }

    // get the attribute values
    if (attributes.length > 0) {
      const select = attributes.map(d => `latest(${quote(d.name)})`).join(', ');
      const attributeValues = await nrdbQuery(accountId, this.getNrql(select));
      attributes.forEach(d => {
        d.latest = attributeValues[0][`latest.${d.name}`];
      });
    }
    console.log('attr', attributes);
    this.setState({ dimensions, attributes });
  }

  renderDimensionsTable() {
    const { dimensions } = this.state;
    const { dimension, setDimension } = this.props;
    if (!dimensions) return <div />;

    return (
      <ul className="dimensions-table">
        {dimensions.map(d => {
          const selected = d.name == dimension ? 'selected' : '';
          return (
            <li
              key={d.name}
              className={`dimensions-table-item ${
                dimension !== undefined ? dimension : ''
              } ${selected}`}
              onClick={() => setDimension(d.name)}
            >
              {d.name} ({d.count})
            </li>
          );
        })}
      </ul>
    );
  }

  renderAttributesTable() {
    const { attributes } = this.state;
    if (!attributes) return <div />;

    return (
      <ul className="attributes-container">
        {attributes.map(a => {
          return (
            <li key={`${a.name}`}>
              <Attribute name={a.name} value={a.latest} />
            </li>
          );
        })}
      </ul>
    );
  }

  render() {
    const { dimensions } = this.state;
    const { attribute } = this.props;
    console.log('attr', attribute);

    if (!attribute) return <div />;
    if (!dimensions) return <Spinner />;

    if (dimensions.length < 10) {
      return (
        <>
          {/* <h3 className="dimensions-table-header">Dimensions</h3>
          {this.renderDimensionsTable()} */}
          <h3 className="attributes-table-header">Attributes</h3>
          {this.renderAttributesTable()}
        </>
      );
    }

    return (
      <Tabs className="col-1-tabs-container">
        <TabsItem
          className="col-1-tabs-item"
          label="Attributes"
          value={2}
          key="2"
        >
          {this.renderAttributesTable()}
        </TabsItem>
      </Tabs>
    );
  }
}
