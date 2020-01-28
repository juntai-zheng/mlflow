import React from 'react';
import { connect } from 'react-redux';
import Utils from '../utils/Utils';
import RequestStateWrapper from './RequestStateWrapper';
import { getMetricHistoryApi, getUUID } from '../Actions';
import PropTypes from 'prop-types';
import _ from 'lodash';
import { MetricsPlotView } from './MetricsPlotView';
import { getRunTags } from '../reducers/Reducers';
import { MetricsPlotControls, X_AXIS_RELATIVE, X_AXIS_STEP } from './MetricsPlotControls';
import qs from 'qs';
import { withRouter } from 'react-router-dom';
import Routes from '../Routes';
import RunLinksPopover from './RunLinksPopover';

export const CHART_TYPE_LINE = 'line';
export const CHART_TYPE_BAR = 'bar';

export class MetricsPlotPanel extends React.Component {
  static propTypes = {
    runUuids: PropTypes.arrayOf(String).isRequired,
    metricKey: PropTypes.string.isRequired,
    // A map of { runUuid : { metricKey: value } }
    latestMetricsByRunUuid: PropTypes.object.isRequired,
    // An array of distinct metric keys across all runUuids
    distinctMetricKeys: PropTypes.arrayOf(String).isRequired,
    // An array of { metricKey, history, runUuid, runDisplayName }
    metricsWithRunInfoAndHistory: PropTypes.arrayOf(Object).isRequired,
    getMetricHistoryApi: PropTypes.func.isRequired,
    location: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    runDisplayNames: PropTypes.arrayOf(String).isRequired,
  };

  constructor(props) {
    super(props);
    const plotMetricKeys = Utils.getPlotMetricKeysFromUrl(props.location.search);
    const selectedMetricKeys = plotMetricKeys.length ? plotMetricKeys : [props.metricKey];
    this.state = {
      selectedXAxis: X_AXIS_RELATIVE,
      selectedMetricKeys,
      showPoint: false,
      historyRequestIds: [],
      yAxisLogScale: false,
      lineSmoothness: 0,

      // states for RunLinkPopover
      popoverVisible: false,
      popoverX: 0,
      popoverY: 0,
      clickedRunUuid: '',
      clickedPointIndex: null,
      runsData: [],
    };
    this.popoverRef = React.createRef();
    this.isClicked = false;
    this.loadMetricHistory(this.props.runUuids, selectedMetricKeys);
  }

  static predictChartType(metrics) {
    // Show bar chart when every metric has exactly 1 metric history
    if (
      metrics &&
      metrics.length &&
      _.every(metrics, (metric) => metric.history && metric.history.length === 1)
    ) {
      return CHART_TYPE_BAR;
    }
    return CHART_TYPE_LINE;
  }

  static isComparing(search) {
    const params = qs.parse(search);
    const runs = params && params['?runs'];
    return runs ? JSON.parse(runs).length > 1 : false;
  }

  updateUrlWithSelectedMetrics(selectedMetricKeys) {
    const { runUuids, metricKey, location, history } = this.props;
    const params = qs.parse(location.search);
    const experimentId = params['experiment'];
    history.push(Routes.getMetricPageRoute(runUuids, metricKey, experimentId, selectedMetricKeys));
  }

  loadMetricHistory = (runUuids, metricKeys) => {
    const requestIds = [];
    const { latestMetricsByRunUuid } = this.props;
    runUuids.forEach((runUuid) => {
      metricKeys.forEach((metricKey) => {
        if (latestMetricsByRunUuid[runUuid][metricKey]) {
          const id = getUUID();
          this.props.getMetricHistoryApi(runUuid, metricKey, id);
          requestIds.push(id);
        }
      });
    });
    return requestIds;
  };

  getMetrics = () => {
    /* eslint-disable no-param-reassign */
    const selectedMetricsSet = new Set(this.state.selectedMetricKeys);
    const { selectedXAxis } = this.state;
    const { metricsWithRunInfoAndHistory } = this.props;

    // Take only selected metrics
    const metrics = metricsWithRunInfoAndHistory.filter((m) => selectedMetricsSet.has(m.metricKey));

    // Sort metric history based on selected x-axis
    metrics.forEach((metric) => {
      const isStep =
        selectedXAxis === X_AXIS_STEP && metric.history[0] && _.isNumber(metric.history[0].step);
      // Metric history can be large. Doing an in-place here to save memory
      metric.history.sort(isStep ? Utils.compareByStepAndTimestamp : Utils.compareByTimestamp);
    });
    return metrics;
  };

  handleYAxisLogScaleChange = (yAxisLogScale) => {
    this.setState({ yAxisLogScale });
  };

  handleXAxisChange = (e) => {
    this.setState({ selectedXAxis: e.target.value });
  };

  handleMetricsSelectChange = (metricValues, metricLabels, { triggerValue }) => {
    const requestIds = this.loadMetricHistory(this.props.runUuids, [triggerValue]);
    this.setState((prevState) => ({
      selectedMetricKeys: metricValues,
      historyRequestIds: [...prevState.historyRequestIds, ...requestIds],
    }));
    this.updateUrlWithSelectedMetrics(metricValues);
  };

  handleShowPointChange = (showPoint) => this.setState({ showPoint });

  handleLineSmoothChange = (lineSmoothness) => this.setState({ lineSmoothness });

  showPopover = () => this.popoverRef.current.setState({ popoverVisible: true })

  hidePopover = () => this.popoverRef.current.setState({ popoverVisible: false })

  updatePopover = (data) => {
    this.isClicked = !this.isClicked;

    // Do not toggle the popover on double click.
    setTimeout(() => {
      if (this.isClicked) {
        this.isClicked = false;
        // this.setState({ isOpen: !this.state.isOpen});
        const { popoverVisible, clickedRunUuid, clickedPointIndex } = this.state;
        const { points, event } = data;
        const clickedDifferentPoint =
          points[0].data.runUuid !== clickedRunUuid || points[0].pointIndex !== clickedPointIndex;

        // Data to pass the popover.
        const runsData = points.map((point) => ({
          color: point.fullData.marker.color,
          runUuid: point.data.runUuid,
        }));
        // Instead of setting state on MetricPlotPanel (current component), should
        // call a method on the Popover directly via the ref
        const popover = this.popoverRef.current;
        popover.setState({
          popoverVisible: !popoverVisible || clickedDifferentPoint,
          popoverX: event.clientX,
          popoverY: event.clientY,
          clickedRunUuid: points[0].data.runUuid,
          clickedPointIndex: points[0].pointIndex,
          runsData,
        });
      }
    }, 300);  // The same delay value as the legend click.
  }

  render() {
    const { runUuids, runDisplayNames, distinctMetricKeys, location } = this.props;
    const {
      historyRequestIds,
      showPoint,
      selectedXAxis,
      selectedMetricKeys,
      yAxisLogScale,
      lineSmoothness,
      popoverVisible,
      popoverX,
      popoverY,
      runsData,
    } = this.state;
    // console.log("hi from MetricsPlotPanel");
    const metrics = this.getMetrics();
    const chartType = MetricsPlotPanel.predictChartType(metrics);
    return (
      <div className='metrics-plot-container'>
        <MetricsPlotControls
          distinctMetricKeys={distinctMetricKeys}
          selectedXAxis={selectedXAxis}
          selectedMetricKeys={selectedMetricKeys}
          handleXAxisChange={this.handleXAxisChange}
          handleMetricsSelectChange={this.handleMetricsSelectChange}
          handleShowPointChange={this.handleShowPointChange}
          handleYAxisLogScaleChange={this.handleYAxisLogScaleChange}
          handleLineSmoothChange={this.handleLineSmoothChange}
          chartType={chartType}
        />
        <RequestStateWrapper
            requestIds={historyRequestIds}
            // In this case where there are no history request IDs (e.g. on the
            // initial page load / before we try to load additional metrics),
            // optimistically render the children
            shouldOptimisticallyRender={historyRequestIds.length === 0}
        >
          <RunLinksPopover
            visible={popoverVisible}
            x={popoverX - 20} // add offset to align the popover arrow to the clicked point.
            y={popoverY}
            runsData={runsData}
            onCloseClick={this.hidePopover}
            ref={this.popoverRef}
          />
          <MetricsPlotView
            runUuids={runUuids}
            runDisplayNames={runDisplayNames}
            xAxis={selectedXAxis}
            metrics={this.getMetrics()}
            metricKeys={selectedMetricKeys}
            showPoint={showPoint}
            chartType={chartType}
            isComparing={MetricsPlotPanel.isComparing(location.search)}
            yAxisLogScale={yAxisLogScale}
            lineSmoothness={lineSmoothness}
            onClick={this.updatePopover}
          />
        </RequestStateWrapper>
      </div>
    );
  }

  // componentDidUpdate(prevProps, prevState) {
  //   Object.entries(this.props).forEach(([key, val]) =>
  //       prevProps[key] !== val && console.log(`Prop '${key}' changed`)
  //   );
  //   if (this.state) {
  //     Object.entries(this.state).forEach(([key, val]) =>
  //         prevState[key] !== val && console.log(`State '${key}' changed`)
  //     );
  //   }
  // }

}

const mapStateToProps = (state, ownProps) => {
  const { runUuids } = ownProps;
  const { latestMetricsByRunUuid, metricsByRunUuid } = state.entities;

  // All metric keys from all runUuids, non-distinct
  const metricKeys = _.flatMap(runUuids, (runUuid) => {
    const latestMetrics = latestMetricsByRunUuid[runUuid];
    return latestMetrics ? Object.keys(latestMetrics) : [];
  });
  const distinctMetricKeys = [...new Set(metricKeys)].sort();

  const runDisplayNames = [];

  // Flat array of all metrics, with history and information of the run it belongs to
  // This is used for underlying MetricsPlotView & predicting chartType for MetricsPlotControls
  const metricsWithRunInfoAndHistory = _.flatMap(runUuids, (runUuid) => {
    const runDisplayName = Utils.getRunDisplayName(getRunTags(runUuid, state), runUuid);
    runDisplayNames.push(runDisplayName);
    const metricsHistory = metricsByRunUuid[runUuid];
    return metricsHistory
      ? Object.keys(metricsHistory).map((metricKey) => {
        const history = metricsHistory[metricKey].map((entry) => ({
          key: entry.key,
          value: entry.value,
          step: Number.parseInt(entry.step, 10) || 0, // default step to 0
          timestamp: Number.parseFloat(entry.timestamp),
        }));
        return { metricKey, history, runUuid, runDisplayName };
      })
      : [];
  });

  return {
    runDisplayNames,
    latestMetricsByRunUuid,
    distinctMetricKeys,
    metricsWithRunInfoAndHistory,
  };
};

const mapDispatchToProps = { getMetricHistoryApi };

export default withRouter(
  connect(
    mapStateToProps,
    mapDispatchToProps,
  )(MetricsPlotPanel),
);
