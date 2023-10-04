function loadData(){
    Promise.all([
      d3.json("data/aoi-points-wgs84.geojson"),
      d3.json("data/raster_extent_wgs84.geojson"),
      d3.json("data/countries-filtered.json"),
      d3.json("data/mexico-states.json")
    ])
    .then(function([aoiExtentJSON,rasterExtentJSON,countriesJSON,statesTOPO]){
        var aoiExtent = aoiExtentJSON;
        var rasterExtent = rasterExtentJSON;
        var countries = topojson.feature(countriesJSON, countriesJSON.objects["countries-filtered"]).features;
        var states = topojson.feature(statesTOPO, statesTOPO.objects["mexico-states"]).features;
        var statesMesh = topojson.mesh(statesTOPO, statesTOPO.objects["mexico-states"], (a,b) => a !== b);
        positionMap(aoiExtent,rasterExtent,countries,states,statesMesh);

    });
}

loadData();

var outerContainer = d3.select("div.container");
var mapContainer = d3.select("div.map");

function maintainAspectRatio() {

  //get width and height of container
  var containerWidth = outerContainer.node().getBoundingClientRect().width;
  var containerHeight = outerContainer.node().getBoundingClientRect().height;

  //fixed aspect ratio based on projected AOI extent
  var widthRatio = 1.45315739117;
  var heightRatio = .68815670352;

  //setup map container to be responsive
  mapContainer.style("max-width", `${widthRatio*containerHeight}px`);
  mapContainer.style("max-height", `${heightRatio*containerWidth}px`);
}



function positionMap(aoiExtent,rasterExtent,countries,states,statesMesh){

  //setup aspect ratio
  maintainAspectRatio();
  //setup listener to adjust map container size
  d3.select(window).on("resize", maintainAspectRatio)

  var w = document.querySelector("div.map").getBoundingClientRect().width;
  var h = document.querySelector("div.map").getBoundingClientRect().height;

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
    const pathMexico = d3.geoPath()
             .projection(albersMexico);

    var svg = mapContainer
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
    			.attr("fill", "#eee")
    			.attr("stroke", "none");

    //state vectors
    svg.append("g").selectAll(".states")
        .data(states)
        .enter()
        .append("path")
            .attr("d", pathMexico)
            .attr("fill", "#cdcdcd")
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


																			                                                                                                                                                                                                                                                                            

}




