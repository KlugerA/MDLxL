import React from 'react';
/** Keep a bad preset/render failure inside Citadel; the source editor remains
 * available and the in-memory preset can still be saved through its owner. */
export default class PaintBoundary extends React.Component{
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){if(!this.state.error)return this.props.children;return <div className="classic-empty-view" role="alert"><div><p>Citadel Paint could not display this preset: {this.state.error.message}</p><p>The last successfully applied model remains available.</p><button onClick={this.props.onSave}>Save preset</button> <button onClick={this.props.onExit}>Return to model</button></div></div>;}
}
