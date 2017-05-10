class Frame extends Base {

  constructor(plotContainerId, totalWidth, totalHeight) {
    super();
    // Frame drawing variables
    this.margins = {
      top: 30, bottom: 40, left: 30, right: 30,
      legend: {bar: 30, upperGap: 30, lowerGap: 20, axisTop: 10},
      panels: {upperGap: 120, lowerGap: 0, gap: 16},
      brushes: {upperGap: 20, height: 50},
      intervals: {bar: 10}};
    this.colorScale = d3.scaleOrdinal(d3.schemeCategory10.concat(d3.schemeCategory20b));
    this.updateDimensions(totalWidth, totalHeight);

    // Frame DOM elements
    this.plotContainer = d3.select('#' + plotContainerId);
    this.svg = null;
    this.svgFilter = null;

    // Frame data variables
    this.dataInput = null;
    this.genomeLength = null;
    this.genomeScale = null;
    this.chromoBins = null;
    this.axis = null;
  }

  updateDimensions(totalWidth, totalHeight) {
    this.totalWidth = totalWidth;
    this.totalHeight = totalHeight;
    this.width = this.totalWidth - this.margins.left - this.margins.right;
    this.height = this.totalHeight - this.margins.top - this.margins.bottom;
  }

  updateData() {
    if (this.dataInput === null) return;
    this.genomeLength = this.dataInput.metadata.reduce((acc, elem) => (acc + elem.endPoint - elem.startPoint + 1), 0);
    this.genomeScale = d3.scaleLinear().domain([0, this.genomeLength]).range([0, this.width])//.nice();
    this.axis = d3.axisTop(this.genomeScale).tickValues(this.genomeScale.ticks(10, 's').concat(this.genomeScale.domain())).ticks(10, 's');
    let boundary = 0
    this.chromoBins = this.dataInput.metadata.reduce((hash, element) => {
      let chromo = new Chromo(element);
      chromo.scaleToGenome = d3.scaleLinear().domain([0, chromo.endPoint]).range([boundary, boundary + chromo.length - 1]);
      chromo.scale = d3.scaleLinear().domain([0, chromo.endPoint]).range([this.genomeScale(boundary), this.genomeScale(boundary + chromo.length - 1)])//.nice();
      chromo.innerScale = d3.scaleLinear().domain([0, chromo.endPoint]).range([this.genomeScale(chromo.startPoint), this.genomeScale(chromo.endPoint)])//.nice();
      chromo.axis = d3.axisBottom(chromo.innerScale).ticks(5, 's');
      hash[element.chromosome] = chromo; 
      boundary += chromo.length;
      return hash; 
    }, {});
    let interval = null;
    this.intervals = this.dataInput.intervals.map((d ,i) => {
      interval = Object.assign({}, d);
      interval.startPlace = this.chromoBins[interval.chromosome].scaleToGenome(interval.startPoint);
      interval.endPlace = this.chromoBins[interval.chromosome].scaleToGenome(interval.endPoint);
      interval.color = this.chromoBins[interval.chromosome].color;
      return interval;
    });
    this.yMax = d3.max(this.dataInput.intervals.map((d, i) => d.y));
    this.yScale = d3.scaleLinear().domain([0, 10, this.yMax]).range([this.height - this.margins.panels.upperGap + this.margins.top, 0.4 * (this.height - this.margins.panels.upperGap + this.margins.top), 0]).nice();
    this.yAxis = d3.axisLeft(this.yScale).tickSize(-this.width).tickValues(d3.range(0, 10).concat(d3.range(10, 10 * Math.round(this.yMax / 10) + 1, 10)));
    this.log()
  }

  render() {
    console.log('redrawing...')
    // Clear any existing svg
    this.plotContainer.selectAll('svg').remove();
    // Add the svg container
    this.svg = this.plotContainer.append('svg')
      .attr('class', 'plot')
      .attr('width', this.totalWidth)
      .attr('height', this.totalHeight);

    this.svgFilter = new SvgFilter(this.svg);
    this.svgFilter.drawShadow();
    
    this.updateData();
    
    this.renderLegend();
    this.renderBrushes();
  }
  
  renderLegend() {
    this.controlsContainer = this.svg.append('g')
      .attr('class', 'legend-container')
      .attr('transform', 'translate(' + [this.margins.left, this.margins.top] + ')');

    this.controlsContainer.append('rect')
      .attr('class', 'legend-bar')
      .attr('transform', 'translate(' + [0, this.margins.legend.upperGap] + ')')
      .attr('width', this.width)
      .attr('height', this.margins.legend.bar)
      .style('opacity', 0.8)
      .style('fill', 'steelblue')
      .style('stroke', 'black');

    let frameAxisContainer = this.controlsContainer
      .append('g')
      .attr('class', 'frame-axis axis axis--x')
      .attr('transform', 'translate(' + [0, this.margins.legend.axisTop] + ')')
      .call(this.axis); 

    let chromoLegendContainer = this.controlsContainer.selectAll('g.chromo-legend-container')
      .data(Object.values(this.chromoBins), (d, i) => d.chromosome)
      .enter()
      .append('g')
      .attr('class', 'chromo-legend-container')
      .attr('transform', (d, i) => ('translate(' + [d.chromoStartPosition, this.margins.legend.upperGap] + ')'))

    chromoLegendContainer
      .append('rect')
      .attr('class', 'chromo-box')
      .attr('width', (d, i) => d.chromoWidth)
      .attr('height', this.margins.legend.bar)
      .style('opacity', 0.66)
      .style('fill', (d, i) => d.color)
      .style('stroke', (d,i) => d3.rgb(d.color).darker(1));
/*
    chromoLegendContainer
      .append('g')
      .attr('class', 'chromo-axis axis axis--x')
      .attr('transform', 'translate(' + [0, this.margins.legend.bar + this.margins.legend.lowerGap] + ')')
      .each(function(d,i) { 
        d3.select(this).call(d.axis).selectAll('text').attr('transform', 'rotate(45)').style('text-anchor', 'start'); 
      });
*/

  }

  renderBrushes() {
    this.brushesContainer = this.controlsContainer.append('g')
      .attr('class', 'brushes')
      .attr('transform', 'translate(' + [0, this.margins.brushes.upperGap] + ')');

    this.panelsContainer = this.svg.append('g')
      .attr('class', 'panels-container')
      .attr('transform', 'translate(' + [this.margins.left, this.margins.panels.upperGap] + ')');

    this.panelsContainer.append('g')
      .attr('class', 'axis axis--y')
      .attr('transform', 'translate(' + [0, 0] + ')')
      .call(this.yAxis);

    this.panelsAxisContainer = this.svg.append('g')
      .attr('class', 'panels-axis-container')
      .attr('transform', 'translate(' + [this.margins.left, this.margins.top + this.height] + ')');

    this.shapesContainer = this.svg.append('g')
      .attr('class', 'shapes-container')
      .attr('transform', 'translate(' + [this.margins.left, this.margins.panels.upperGap] + ')');

    this.brushContainer = new BrushContainer(this);
    this.brushContainer.render();
  }

}