
//global references
var outerContainer = d3.select("div.container");
var mapContainer = d3.select("div.map");
//data
var aoiExtent;
var rasterExtent;
var countries;
var states;
var statesMesh;
var detentions;
//svg and path
var svg;
var pathMexico;
var spikes;
//for adjusting symbol size relative to viewbox
var w;
var h;
var ratioViewbox = 1;

//for slider
var currentTime = "1-2001";
var timeElement = d3.select("span.highlight");



function loadData(){
    Promise.all([
      d3.json("data/aoi-points-wgs84.geojson"),
      d3.json("data/raster_extent_wgs84.geojson"),
      d3.json("data/countries-filtered.json"),
      d3.json("data/mexico-states.json"),
      d3.csv("data/presentados-series.csv")
    ])
    .then(function([aoiExtentJSON,rasterExtentJSON,countriesJSON,statesTOPO,presentados]){
        aoiExtent = aoiExtentJSON;
        rasterExtent = rasterExtentJSON;
        countries = topojson.feature(countriesJSON, countriesJSON.objects["countries-filtered"]).features;
        states = topojson.feature(statesTOPO, statesTOPO.objects["mexico-states"]).features;
        statesMesh = topojson.mesh(statesTOPO, statesTOPO.objects["mexico-states"], (a,b) => a !== b);
        detentions = presentados;

        joinData();
        positionMap();
    });
}

loadData();
//make slider

function dateRange(startDate, endDate) {
  var start      = startDate.split('-');
  var end        = endDate.split('-');
  var startYear  = parseInt(start[1]);
  var endYear    = parseInt(end[1]);
  var dates      = [];

  for(var i = startYear; i <= endYear; i++) {
    var endMonth = i != endYear ? 11 : parseInt(end[0]) - 1;
    var startMon = i === startYear ? parseInt(start[0])-1 : 0;
    for(var j = startMon; j <= endMonth; j = j > 12 ? j % 12 || 11 : j+1) {
      var month = j+1;
      var displayMonth = month < 10 ? '0'+month : month;
      dates.push([displayMonth,i].join('-'));
    }
  }
  return dates;
}

var formatDate = function(dateString){
    var [m,y] = dateString.split("-");
    var date = new Date(y,m-1,1).getTime();
    return date;
}

function fmtMonthYear(time){
  var dateObj = new Date(time);
  var month = dateObj.toLocaleString('default', { month: 'long' });
  var year = dateObj.getFullYear();
  return month + " " + year;
}

function fmtMonthYearNum(time){
  var dateObj = new Date(time);
  var month = dateObj.getMonth()+1;
  var year = dateObj.getFullYear();
  return month + "-" + year;
}

function makeSliderRange(dateRange){
  var range = {};
  var steps = dateRange.length;
  for(var i = 0; i < dateRange.length; i++){

      if(i==0){
        range["min"] = formatDate(dateRange[i]);
      } else if (i==dateRange.length-1){
        range["max"] = formatDate(dateRange[i]);
      } else {
        range[`${100/steps*i}%`] = formatDate(dateRange[i]);
      }
  }
  return range;

}


function makeSlider(){
  // make slider
  var slider = document.getElementById('slider');

  var range = dateRange("1-2001","7-2023");
  var formattedRange = makeSliderRange(range);

  noUiSlider.create(slider, {
      start: [formatDate("1-2001")],
      snap: true,
      range: formattedRange
        //   pips: {
    //      mode: 'steps',
    //      filter: function ( value, type ) {
    //       return (years.indexOf(value) != -1) ? 0 : -1;
    // }
  });

  var userInteracted = false; //check whether user has interacted
  var hasStarted = false;

  //event handling
  slider.noUiSlider.on("update", function(){
    var time = slider.noUiSlider.get(true);
    var monthYear = fmtMonthYearNum(time);
    //if new time
    if(currentTime != monthYear){
      //reset current
      currentTime = monthYear;
      //update text
      timeElement.html(fmtMonthYear(time));
      //redraw spikes
      updateSpikes();

    }


  })

  slider.noUiSlider.on("slide", function(){
      userInteracted = true;
  })

  //above fires once on creation, so reset userInteracted to false
  userInteracted = false;

  // function animateFrames(year){
  //   //if slider is used stop animation
  //   if(userInteracted) return;

  //   //otherwise loop through
  //   slider.noUiSlider.set(year);

  //   //get refererence to next frame
  //   var i = years.indexOf(year); //current index
  //   if(i<years.length-1){
  //     i++;
  //   } else {
  //     i = 0;
  //   }

  //   setTimeout(function(){
  //     animateFrames(years[i]);
  //   },1500);


  // }
  // //start animation
  // animateFrames();

}



makeSlider();

function joinData(){
  //join data
  for(var state of states){
      var geoid = state.properties.fips;
      var match = detentions.filter(d => d.geoid == geoid)[0];
      state.properties.spikeData = match;
  }

}

function maintainAspectRatio(first) {

  //get width and height of container
  var containerWidth = outerContainer.node().getBoundingClientRect().width;
  var containerHeight = outerContainer.node().getBoundingClientRect().height;

  //fixed aspect ratio based on projected AOI extent
  var widthRatio = 1.45315739117;
  var heightRatio = .68815670352;

  //setup map container to be responsive
  mapContainer.style("max-width", `${widthRatio*containerHeight}px`);
  mapContainer.style("max-height", `${heightRatio*containerWidth}px`);


  if(!first){
    //update ratio to viewbox size then draw spikes
    var currentW = mapContainer.node().getBoundingClientRect().width;
    ratioViewbox = w/currentW;
    updateSpikes();
  }

}



function positionMap(){

  //setup aspect ratio
  maintainAspectRatio(true);
  
  //no page resize
  d3.select(window).on("resize", function(){
    maintainAspectRatio();
  })

  w = document.querySelector("div.map").getBoundingClientRect().width;
  h = document.querySelector("div.map").getBoundingClientRect().height;

  var margin = {top: 0, right: 0, bottom: 0, left: 0}

  //set projection centered on mexico
	const centerLocation = {
	  "longitude": -104.0625,
	  "latitude": 22.7427729
	};

	//albers centered on mexico
	const albersMexico = d3.geoConicEqualArea()
	                  .parallels([15.0331922,30.4523535]) 
	                  .rotate([centerLocation["longitude"]*-1,0,0])
	                  .center([0,centerLocation["latitude"]])
	                  .fitExtent([[margin.left,margin.top],[w-margin.right,h-margin.bottom]], aoiExtent);
;

	//path generator
    pathMexico = d3.geoPath()
             .projection(albersMexico);

    svg = mapContainer
              .append("svg")
              .attr("viewBox", `0 0 ${w} ${h}`)
              .attr("overflow", "visible")
              .style("position", "relative")
              .style("preserveAspectRatio", "xMidYMid meet");


    // svg.append("g").selectAll(".aoi")
    //      .data(aoiExtent.features)
    //      .enter()
    //      .append("path")
    //          .attr("d", pathMexico)
    //          .attr("fill", "none")
    //          .attr("stroke", "#000")
    //          .attr("stroke-width", 0.5);

    // //calculate raster extent percentages
    // var rasterBounds = pathMexico.bounds(rasterExtent);
    // var rasterWidth = (rasterBounds[1][0] - rasterBounds[0][0])/w*100;
    // var rasterOrigin = [rasterBounds[0][0]/w*100,rasterBounds[0][1]/h*100];

    // //append raster background
    // svg.append("image")
    //         .attr("href", "data/backdrop.jpg")
    //         .attr("x", rasterOrigin[0]+"%")
    //         .attr("y", rasterOrigin[1]+"%")
    //         .attr("width", rasterWidth + "%")
    //         .attr("transform", "translate(-0.5,2)");

    //country vectors
    svg.append("g").selectAll(".countries")
    		.data(countries)
    		.enter()
    		.append("path")
    			.attr("d", pathMexico)
    			.attr("fill", "#ddd")
    			.attr("stroke", "none");

    //state vectors
    svg.append("g").selectAll(".states")
        .data(states)
        .enter()
        .append("path")
            .attr("d", pathMexico)
            .attr("fill", "#ccc")
            .attr("stroke", "none");

    //states mesh (inner boundaries only)
    svg.append("g")
        .append("path")
          .datum(statesMesh)
          .attr("d", pathMexico)
          .attr("fill", "none")
          .attr("stroke-linejoin", "round")
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5);

    var spikeGroups = svg.append("g").attr("class", "spikes")
                  .attr("fill", "black")
                  .attr("fill-opacity", 0.5)
                  .attr("stroke", "black")
                  .attr("stroke-width", 0.5)
                  .selectAll("g")
                  .data(states)
                  .enter()
                  .append("g")
                    .attr("transform", function(d){
                      var x = pathMexico.centroid(d)[0];
                      var y = pathMexico.centroid(d)[1];
                      //adjust Chiapas & Tabasco
                      if(d.properties["name"]=="Chiapas"){
                        x+=3;
                      }
                      if(d.properties["name"]=="Tabasco"){
                        x-=2;
                        y-=2;
                      }
                      return `translate(${x},${y})`;
                    });

      spikes =  spikeGroups.append("path");

      var defaultLabels = ["Chiapas","Tamaulipas","Baja California", "Oaxaca","Chihuahua","Veracruz"];

      //add labels/tooltips
      var spikeLabels = mapContainer.select("div.labels").selectAll("div")
                                        .data(states)
                                        .join("div")
                                        .html(function(d){
                                          return `<p>${d.properties["name"]}</p>`
                                        })
                                        .style("left", function(d){
                                          var x = pathMexico.centroid(d)[0];
                                          //adjust Chiapas & Tabasco
                                          if(d.properties["name"]=="Chiapas"){
                                            x+=3;
                                          }
                                          if(d.properties["name"]=="Tabasco"){
                                            x-=2;
                                          }
                                          var xPer = x/w*100;
                                          return xPer+"%";
                                        })
                                        .style("top", function(d){
                                          var y = pathMexico.centroid(d)[1];
                                          //adjust Chiapas & Tabasco
                                          if(d.properties["name"]=="Tabasco"){
                                            y-=2;
                                          }
                                          var yPer = y/h*100;
                                          return yPer+"%";
                                        })
                                        .style("opacity", d => (defaultLabels.indexOf(d.properties["name"]) == -1) ? 0 : 1)

                                      
    updateSpikes();
							                                                                                                                                                                                                                                                                            
}

function updateSpikes(){


  var spikeWidth = 10*ratioViewbox;
  //spikes
  function spike(length, width = spikeWidth){
    return `M${-width / 2},0L0,${-length}L${width / 2},0`;
  }

  var spikeMaxHeight = 500*ratioViewbox;
  //adjust if mobile(Chiapas escaping)

  // Construct the length scale.
  var spikeScale = d3.scaleLinear()
                      .domain([0,30000])
                      .range([1,spikeMaxHeight]);

  //draw spikes
  spikes.attr("d", d => spike(spikeScale(Number(d.properties.spikeData[currentTime]))))
        .attr("opacity", d => (d.properties.spikeData[currentTime]==0 ? 0 : 1));
      
}




