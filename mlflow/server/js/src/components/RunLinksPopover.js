import React from 'react';
import PropTypes from 'prop-types';
import { Popover } from 'antd';
import {X_AXIS_RELATIVE} from "./MetricsPlotControls";

class RunLinksPopover extends React.Component {
  static propTypes = {
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    visible: PropTypes.bool.isRequired,
    onCloseClick: PropTypes.func.isRequired,
    runsData: PropTypes.arrayOf(Object).isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      // states for RunLinkPopover
      popoverVisible: false,
      popoverX: 0,
      popoverY: 0,
      clickedRunUuid: '',
      clickedPointIndex: null,
      runsData: [],
    };
  }

  renderPopoverContent = () => {
    const { runsData } = this.state;
    return (
      <div>
        {runsData.map(({ runUuid, color }) => (
          <p key={runUuid}>
            <a href="" style={{ color }}>
              {runUuid}
            </a>
          </p>
        ))}
      </div>
    );
  };

  renderTitle = () => {
    const { onCloseClick } = this.props;
    return (
      <div>
        <span>Jump to the run</span>
        <a onClick={onCloseClick} style={{ float: 'right' }}>
          <i className="fas fa-times"></i>
        </a>
      </div>
    );
  };

  render() {
    const { popoverX, popoverY, popoverVisible } = this.state;
    return (
      <Popover
        content={this.renderPopoverContent()}
        title={this.renderTitle()}
        placement="topLeft"
        visible={popoverVisible}
      >
        {/* dummy div to control the position of the popover */}
        <div
          style={{
            left: popoverX,
            top: popoverY,
            position: 'absolute',
          }}
        />
      </Popover>
    );
  }
}

export default RunLinksPopover;
