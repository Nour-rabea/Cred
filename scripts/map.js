$(window).on('load', function() {
  var documentSettings = {};
  var group2color = {};

  var polygonSettings = [];
  var polygonsLegend;

  var completePoints = false;
  var completePolygons = false;
  var completePolylines = false;

  /**
   * Returns an Awesome marker with specified parameters
   */
  function createMarkerIcon(icon, prefix, markerColor, iconColor) {
    return L.AwesomeMarkers.icon({
      icon: icon,
      prefix: prefix,
      markerColor: markerColor,
      iconColor: iconColor
    });
  }

  /**
   * Sets the map view so that all markers are visible, or
   * to specified (lat, lon) and zoom if all three are specified
   */
  function centerAndZoomMap(points) {
    var lat = map.getCenter().lat, latSet = false;
    var lon = map.getCenter().lng, lonSet = false;
    var zoom = 12, zoomSet = false;
    var center;

    if (getSetting('_initLat') !== '') {
      lat = getSetting('_initLat');
      latSet = true;
    }

    if (getSetting('_initLon') !== '') {
      lon = getSetting('_initLon');
      lonSet = true;
    }

    if (getSetting('_initZoom') !== '') {
      zoom = parseInt(getSetting('_initZoom'));
      zoomSet = true;
    }

    if ((latSet && lonSet) || !points) {
      center = L.latLng(lat, lon);
    } else {
      center = points.getBounds().getCenter();
    }

    if (!zoomSet && points) {
      zoom = map.getBoundsZoom(points.getBounds());
    }

    map.setView(center, zoom);
  }

  /**
   * Given a collection of points, determines the layers based on 'Group'
   * column in the spreadsheet.
   */
  function determineLayers(points) {
    var groups = [];
    var layers = {};

    for (var i in points) {
      var group = points[i].Group;
      if (group && groups.indexOf(group) === -1) {
        // Add group to groups
        groups.push(group);

        // Add color to the crosswalk
        group2color[ group ] = points[i]['Marker Icon'].indexOf('.') > 0
          ? points[i]['Marker Icon']
          : points[i]['Marker Color'];
      }
    }
   
    // if none of the points have named layers, return no layers
    if (groups.length === 0) {
      layers = undefined;
    } else {
      for (var i in groups) {
        var name = groups[i];
        layers[name] = L.layerGroup();
        layers[name].addTo(map);
      }
    }
    return layers;
  }

  /**
   * Assigns points to appropriate layers and clusters them if needed
   */
  function mapPoints(points, layers) {
    var markerArray = [];
    // check that map has loaded before adding points to it?
    for (var i in points) {
      var point = points[i];

      // If icon contains '.', assume it's a path to a custom icon,
      // otherwise create a Font Awesome icon
      var iconSize = point['Custom Size'];
      var size = (iconSize.indexOf('x') > 0)
        ? [parseInt(iconSize.split('x')[0]), parseInt(iconSize.split('x')[1])]
        : [32, 32];

      var anchor = [size[0] / 2, size[1]];

      var icon = (point['Marker Icon'].indexOf('.') > 0)
        ? L.icon({
          iconUrl: point['Marker Icon'],
          iconSize: size,
          iconAnchor: anchor
        })
        : createMarkerIcon(point['Marker Icon'],
          'fa',
          point['Marker Color'].toLowerCase(),
          point['Icon Color']
        );

      if (point.Latitude !== '' && point.Longitude !== '') {
        var marker = L.marker([point.Latitude, point.Longitude], {icon: icon})
          .bindPopup("<b>" + point['Project'] + '</b><br>' +
          point['Developer'] + '</b><br>' +
          (point['Image'] ? ('<img src="' + point['Image'] + '"><br>') : '') +
          point['Hotline'] + '</b><br>' +
          point['Website'] + '</b><br>' +
          point['Brochure'] + '</b><br>' +
          point['Head Offices'] + '</b><br>' +
          point['Area'] + '</b> Acre <br>')
          .bindTooltip("<b>" + point['Project'] + '</b><br>' +
          point['Developer'], {permanent: false, direction: 'right'});

        if (layers !== undefined && layers.length !== 1) {
          marker.addTo(layers[point.Group]);
        }

        markerArray.push(marker);
      }
    }

    var group = L.featureGroup(markerArray);
    var clusters = (getSetting('_markercluster') === 'on') ? true : false;

    // if layers.length === 0, add points to map instead of layer
    if (layers === undefined || layers.length === 0) {
      map.addLayer(
        clusters
        ? L.markerClusterGroup().addLayer(group).addTo(map)
        : group
      );
    } else {
      if (clusters) {
        // Add multilayer cluster support
        multilayerClusterSupport = L.markerClusterGroup.layerSupport();
        multilayerClusterSupport.addTo(map);

        for (i in layers) {
          multilayerClusterSupport.checkIn(layers[i]);
          layers[i];
        }
      }

      var pos = (getSetting('_pointsLegendPos') == 'off')
        ? 'topleft'
        : getSetting('_pointsLegendPos');

      var pointsLegend = L.control.layers(null, layers, {
        collapsed: false,
        position: pos,
      });

      if (getSetting('_pointsLegendPos') !== 'off') {
        pointsLegend.addTo(map);
        pointsLegend._container.id = 'points-legend';
        pointsLegend._container.className += ' ladder';
      }
    }

    $('#points-legend').prepend('<h6 class="pointer">' + getSetting('_pointsLegendTitle') + '</h6>');
    if (getSetting('_pointsLegendIcon') != '') {
      $('#points-legend h6').prepend('<span class="legend-icon"><i class="fas '
        + getSetting('_pointsLegendIcon') + '"></i></span>');
    }

    //* */ Display table with active points if specified
    var tableVisible = false; // Variable to track table visibility
    var tableHeight = 40; // Default table height
    var table; // Variable to hold the DataTable instance

    document.getElementById("container").onclick = toggleTable;
    
    function toggleTable() {
      if (tableVisible) {
        hideTable();
        tableVisible = false;
      } else {
        showTable();
        tableVisible = true;
      }
    }
    
    function showTable() {
      var columns = getSetting('_tableColumns').split(',')
      .map(Function.prototype.call, String.prototype.trim);
    
      if (columns.length > 1) {
        tableHeight = trySetting('_tableHeight', 40);
        if (tableHeight < 10 || tableHeight > 90) { tableHeight = 40; }
    
        $('#map').css('height', (100 - tableHeight) + 'vh'); // Adjust the map height
        map.invalidateSize();
    
        var colors = getSetting('_tableHeaderColor').split(',');
        if (colors[0] !== '') {
          $('table.display').css('background-color', colors[0]);
          if (colors.length >= 2) {
            $('table.display').css('color', colors[1]);
          }
        }
      // Initialize DataTable
      if (!$.fn.DataTable.isDataTable('#maptable')) {
        table = $('#maptable').DataTable({
        paging: false,
        scrollCollapse: true,
        scrollY: 'calc(' + tableHeight + 'vh - 40px)',
        info: false,
        searching: false,
        columns: generateColumnsArray(),
      });

            // Show the DataTable
            $('#maptable').show(); // Make sure the DataTable is visible
            updateTable();// Call updateTable to populate the DataTable with current points
            map.on('moveend', updateTable);
            map.on('layeradd', updateTable);
            map.on('layerremove', updateTable);
        
// Add mouseover event to table cells
$('#maptable tbody').on('mouseover', 'td', function() {
  var rowData = table.row(this).data(); // Get the data for the row after sorting/filtering
  var point = rowData[rowData.length - 1]; // Assuming the last element is the full point object
  // Update the tooltip content dynamically based on the current row's data
  var tooltipContent = point['Analysis SQM.P']; // Content to show in the tooltip  
  // Remove any existing tooltip to prevent duplication
  $('.custom-tooltip').remove();
  // Create the tooltip element
  var tooltip = $('<div class="custom-tooltip"></div>').text(tooltipContent).appendTo('body');
  // Move the tooltip with the mouse
  $(this).on('mousemove', function(e) {
    tooltip.css({
      top: e.pageY + 10 + 'px', // Positioning the tooltip below the mouse pointer
      left: e.pageX + 10 + 'px' // Positioning the tooltip to the right of the mouse pointer
    });
  });
}).on('mouseout', function() {
  // Remove the tooltip when the mouse leaves the cell
  $('.custom-tooltip').remove();
});
    
      // Add click event to table rows
      $('#maptable tbody').on('click', 'tr', function() {
        var rowData = table.row(this).data(); // Get the data for the clicked row
        var point = rowData[rowData.length - 1]; // Assuming the last element is the full point object
        var lat = point['Latitude'];
        var lon = point['Longitude'];
        if (!isNaN(lat) && !isNaN(lon)) { // Check if the lat and lon are valid numbers
          map.flyTo([lat, lon], 15, { animate: true, duration: 3 }); // Fly to the coordinates
          drawCircle(lat, lon); // Draw a circle at the location
        } else {
          alert("Invalid coordinates.");
        }
      });
    }

function drawCircle(lat, lon) {
  // Define the circle options
  var circleOptions = {
      color: 'black',      // Circle color
      fillColor: '#000',   // Fill color
      fillOpacity: 0.1,    // Fill opacity
      radius: 150          // Circle radius in meters
      };

  // Create the circle
  var circle = L.circle([lat, lon], circleOptions).addTo(map);

  // Return the circle object (optional)
  return circle;}

  function updateTable() {
    var pointsVisible = [];
    for (var i in points) {
      if (map.hasLayer(layers[points[i].Group]) &&
          map.getBounds().contains(L.latLng(points[i].Latitude, points[i].Longitude))) {
        pointsVisible.push(points[i]);
      }
    }
  
    tableData = pointsToTableData(pointsVisible);
    table.clear();
    table.rows.add(tableData);
    table.draw();
  }
  
  function pointsToTableData(ms) {
    var data = [];
    for (var i in ms) {
        var a = [];
        for (var j in columns) {
            a.push(ms[i][columns[j]]); // Push only the visible columns
        }
        a.push(ms[i]); // Push the entire point object to access later
        data.push(a);
    }
    return data;
}

  function generateColumnsArray() {
    var c = [];
    for (var i in columns) {
      c.push({ title: columns[i] });
    }
    return c;
  }
}}

function hideTable() {
  // Check if the DataTable is initialized
  if ($.fn.DataTable.isDataTable('#maptable')) {
    // Destroy the DataTable instance before hiding
    $('#maptable').DataTable().clear().destroy();
  }

  // Hide the entire table element, including the header
  $('#maptable').hide(); // Hide the DataTable

  // Optionally, hide the header explicitly if needed
  $('#maptable thead').hide(); // Hide the table header

  $('#map').css('height', '100vh'); // Reset the map height to full screen
}

completePoints = true;
return group;
}

  var polygon = 0; // current active polygon
  var layer = 0; // number representing current layer among layers in legend
  
  /**
   * Store bucket info for Polygons
   */
  allDivisors = [];
  allColors = [];
  allIsNumerical = [];
  allGeojsons = [];
  allPolygonLegends = [];
  allPolygonLayers = [];
  allPopupProperties = [];
  allTextLabelsLayers = [];
  allTextLabels = [];

  function loadAllGeojsons(p) {
    if (p < polygonSettings.length && getPolygonSetting(p, '_polygonsGeojsonURL').trim()) {
      // Pre-process popup properties to be used in onEachFeature below
      polygon = p;
      var popupProperties = getPolygonSetting(p, '_popupProp').split(';');
      for (i in popupProperties) { popupProperties[i] = popupProperties[i].split(','); }
      allPopupProperties.push(popupProperties);

      // Load geojson
      $.getJSON(getPolygonSetting(p, '_polygonsGeojsonURL').trim(), function(data) {
          geoJsonLayer = L.geoJson(data, {
            onEachFeature: onEachFeature,
            pointToLayer: function(feature, latlng) {
              return L.circleMarker(latlng, {
                className: 'geojson-point-marker'
              });
            }
          });
          allGeojsons.push(geoJsonLayer);
          loadAllGeojsons(p+1);
      });
    } else {
      processAllPolygons();
    }
  }

  function processAllPolygons() {
    var p = 0;  // polygon sheet

    while (p < polygonSettings.length && getPolygonSetting(p, '_polygonsGeojsonURL').trim()) {
      isNumerical = [];
      divisors = [];
      colors = [];

      polygonLayers = getPolygonSetting(p, '_polygonLayers').split(';');
      for (i in polygonLayers) { polygonLayers[i] = polygonLayers[i].split(','); }

      divisors = getPolygonSetting(p, '_bucketDivisors').split(';');

      if (divisors.length != polygonLayers.length) {
        alert('Error in Polygons: The number of sets of divisors has to match the number of properties');
        return;
      }

      colors = getPolygonSetting(p, '_bucketColors').split(';');
      for (i = 0; i < divisors.length; i++) {
        divisors[i] = divisors[i].split(',');
        for (j = 0; j < divisors[i].length; j++) {
          divisors[i][j] = divisors[i][j].trim();
        }
        if (!colors[i]) {
          colors[i] = [];
        } else {
          colors[i] = colors[i].split(',');
        }
      }

      for (i = 0; i < divisors.length; i++) {
        if (divisors[i].length == 0) {
          alert('Error in Polygons: The number of divisors should be > 0');
          return; // Stop here
        } else if (colors[i].length == 0) {
          // If no colors specified, generate the colors
          colors[i] = palette(tryPolygonSetting(p, '_colorScheme', 'tol-sq'), divisors[i].length);
          for (j = 0; j < colors[i].length; j++) {
            colors[i][j] = '#' + colors[i][j].trim();
          }
        } else if (divisors[i].length != colors[i].length) {
          alert('Error in Polygons: The number of divisors should match the number of colors');
          return; // Stop here
        }
      }

      // For each set of divisors, decide whether textual or numerical
      for (i = 0; i < divisors.length; i++) {
        if (!isNaN(parseFloat(divisors[i][0].trim()))) {
          isNumerical[i] = true;
          for (j = 0; j < divisors[i].length; j++) {
            divisors[i][j] = parseFloat(divisors[i][j].trim());
          }
        } else {
          isNumerical[i] = false;
        }
      }

      allDivisors.push(divisors);
      allColors.push(colors);
      allIsNumerical.push(isNumerical);
      allPolygonLayers.push(polygonLayers);

      var legendPos = tryPolygonSetting(p, '_polygonsLegendPosition', 'off');
      polygonsLegend = L.control({position: (legendPos == 'off') ? 'topleft' : legendPos});

      polygonsLegend.onAdd = function(map) {
        var content = '<h6 class="pointer">' + getPolygonSetting(p, '_polygonsLegendTitle') + '</h6>';
        content += '<form>';

        for (i in polygonLayers) {
          var layer = polygonLayers[i][1]
            ? polygonLayers[i][1].trim()
            : polygonLayers[i][0].trim();

            layer = (layer == '') ? 'On' : layer;

          content += '<label><input type="radio" name="prop" value="' + p + ';' + i + '"> ';
          content += layer + '</label><br>';
        }

        content += '<label><input type="radio" name="prop" value="' + p + ';-1"> Off</label></form><div class="polygons-legend-scale">';

        var div = L.DomUtil.create('div', 'leaflet-control leaflet-control-custom leaflet-bar ladder polygons-legend' + p);
        div.innerHTML = content;
        div.innerHTML += '</div>';
        return div;
      };

      polygonsLegend.addTo(map);
      if (getPolygonSetting(p, '_polygonsLegendPosition') == 'off') {
        $('.polygons-legend' + p).css('display', 'none');
      }
      allPolygonLegends.push(polygonsLegend);

      p++;
    }

    // Generate polygon labels layers
    for (var i in allTextLabels) {
      var g = L.featureGroup(allTextLabels[i]);
      allTextLabelsLayers.push(g);
    }

    // This is triggered when user changes the radio button
    $('.ladder input:radio[name="prop"]').change(function() {
      polygon = parseInt($(this).val().split(';')[0]);
      layer = parseInt($(this).val().split(';')[1]);

      if (layer == -1) {
        $('.polygons-legend' + polygon).find('.polygons-legend-scale').hide();
        if (map.hasLayer(allGeojsons[polygon])) {
          map.removeLayer(allGeojsons[polygon]);
          if (map.hasLayer(allTextLabelsLayers[polygon])) {
            map.removeLayer(allTextLabelsLayers[polygon]);
          }
        }
      } else {
        updatePolygons();
      }
    });

    for (t = 0; t < p; t++) {
      if (getPolygonSetting(t, '_polygonShowOnStart') == 'on') {
        $('.ladder input:radio[name="prop"][value="' + t + ';0"]').click();
      } else {
        $('.ladder input:radio[name="prop"][value="' + t + ';-1"]').click();
      }
    }

    $('.polygons-legend-merged h6').eq(0).click().click();

    completePolygons = true;
  }


  function updatePolygons() {
    p = polygon;
    z = layer;
    allGeojsons[p].setStyle(polygonStyle);

    if (!map.hasLayer(allGeojsons[p])) {
      map.addLayer(allGeojsons[p]);
      if (!map.hasLayer(allTextLabelsLayers[p]) && allTextLabelsLayers[p]) {
        map.addLayer(allTextLabelsLayers[p]);
      }
    }

    doubleClickPolylines();

    // If no scale exists: hide the legend. Ugly temporary fix.
    // Can't use 'hide' because it is later toggled
    if (allDivisors[p][z] == '') {
      $('.polygons-legend' + p).find('.polygons-legend-scale').css(
        {'margin': '0px', 'padding': '0px', 'border': '0px solid'}
      );
      return;
    }

    $('.polygons-legend' + p + ' .polygons-legend-scale').html('');

    var labels = [];
    var from, to, isNum, color;

    for (var i = 0; i < allDivisors[p][z].length; i++) {
      var isNum = allIsNumerical[p][z];
      var from = allDivisors[p][z][i];
      var to = allDivisors[p][z][i+1];

      var color = getColor(from);
      from = from ? comma(from) : from;
      to = to ? comma(to) : to;

      labels.push(
        '<i style="background:' + color + '; opacity: '
        + tryPolygonSetting(p, '_colorOpacity', '0.7') + '"></i> ' +
        from + ((to && isNum) ? '&ndash;' + to : (isNum) ? '+' : ''));
    }

    $('.polygons-legend' + p + ' .polygons-legend-scale').html(labels.join('<br>'));
    $('.polygons-legend' + p + ' .polygons-legend-scale').show();

    togglePolygonLabels();
  }

  /**
   * Generates CSS for each geojson feature
   */
  function polygonStyle(feature) {
    var value = feature.properties[allPolygonLayers[polygon][layer][0].trim()];

    if (feature.geometry.type == 'Point') {
      return {  // Point style
        radius: 4,
        weight: 1,
        opacity: 1,
        color: getColor(value),
        fillOpacity: tryPolygonSetting(polygon, '_colorOpacity', '0.7'),
        fillColor: 'white'
      }
    } else {
      return {  // Polygon and Polyline style
        weight: 2,
        opacity: 1,
        color: tryPolygonSetting(polygon, '_outlineColor', 'white'),
        dashArray: '3',
        fillOpacity: tryPolygonSetting(polygon, '_colorOpacity', '0.7'),
        fillColor: getColor(value)
      }
    }
  }

  /**
   * Returns a color for polygon property with value d
   */
  function getColor(d) {
    var num = allIsNumerical[polygon][layer];
    var col = allColors[polygon][layer];
    var div = allDivisors[polygon][layer];

    var i;

    if (num) {
      i = col.length - 1;
      while (d < div[i]) i -= 1;
    } else {
      for (i = 0; i < col.length - 1; i++) {
        if (d == div[i]) break;
      }
    }

    if (!col[i]) {i = 0}
    return col[i];
  }


  /**
   * Generates popup windows for every polygon
   */
  function onEachFeature(feature, layer) {
    // Do not bind popups if 1. no popup properties specified and 2. display
    // images is turned off.
    if (getPolygonSetting(polygon, '_popupProp') == ''
     && getPolygonSetting(polygon, '_polygonDisplayImages') == 'off') return;

    var info = '';
    props = allPopupProperties[polygon];

    for (i in props) {
      if (props[i] == '') { continue; }

      info += props[i][1]
        ? props[i][1].trim()
        : props[i][0].trim();

      var val = feature.properties[props[i][0].trim()];
      info += ': <b>' + (val ? comma(val) : val) + '</b><br>';
    }

    if (getPolygonSetting(polygon, '_polygonDisplayImages') == 'on') {
      if (feature.properties['img']) {
        info += '<img src="' + feature.properties['img'] + '">';
      }
    }

    layer.bindPopup(info);


    // Add polygon label if needed
    if (!allTextLabels[polygon]) { allTextLabels.push([]) }

    if (getPolygonSetting(polygon, '_polygonLabel') !== '') {
      var myTextLabel = L.marker(polylabel(layer.feature.geometry.coordinates, 1.0).reverse(), {
        icon: L.divIcon({
          className: 'polygon-label' + polygon + ' polygon-label',
          html: feature.properties[getPolygonSetting(polygon, '_polygonLabel')],
        })
      });
      allTextLabels[polygon].push(myTextLabel);
    }
  }

  /**
   * Perform double click on polyline legend checkboxes so that they get
   * redrawn and thus get on top of polygons
   */
  function doubleClickPolylines() {
    $('#polylines-legend form label input').each(function(i) {
      $(this).click().click();
    });
  }

  /**
   * Here all data processing from the spreadsheet happens
   */
  function onMapDataLoad(options, points, polylines) {

    createDocumentSettings(options);

    ///document.title = getSetting('_mapTitle');
    document.title = 'Market Analysis';
    addBaseMap();

    // Add point markers to the map
    var layers;
    var group = '';
    if (points && points.length > 0) {
      layers = determineLayers(points);
      group = mapPoints(points, layers);
    } else {
      completePoints = false;
    }

    centerAndZoomMap(group);

    // Add polylines
    if (polylines && polylines.length > 0) {
      processPolylines(polylines);
    } else {
      completePolylines = true;
    }

    // Add polygons
    if (getPolygonSetting(0, '_polygonsGeojsonURL')
      && getPolygonSetting(0, '_polygonsGeojsonURL').trim()) {
      loadAllGeojsons(0);
    } else {
      completePolygons = true;
    }



    // Change Map attribution to include author's info + urls
    changeAttribution();

    // Append icons to categories in markers legend
    $('#points-legend label span').each(function(i) {
      var g = $(this).text().trim();
      var legendIcon = (group2color[ g ].indexOf('.') > 0)
        ? '<img src="' + group2color[ g ] + '" class="markers-legend-icon">'
        : '&nbsp;<i class="fas fa-map-marker" style="color: '
          + group2color[ g ]
          + '"></i>';
      $(this).prepend(legendIcon);
    });

    // When all processing is done, hide the loader and make the map visible
    showMap();

    function showMap() {
      if (completePoints && completePolylines && completePolygons) {
        $('.ladder h6').append('<span class="legend-arrow"><i class="fas fa-chevron-down"></i></span>');
        $('.ladder h6').addClass('minimize');

        for (i in allPolygonLegends) {
          if (getPolygonSetting(i, '_polygonsLegendIcon') != '') {
            $('.polygons-legend' + i + ' h6').prepend(
              '<span class="legend-icon"><i class="fas ' + getPolygonSetting(i, '_polygonsLegendIcon') + '"></i></span>');
          }
        }

        $('.ladder h6').click(function() {
          if ($(this).hasClass('minimize')) {
            $('.ladder h6').addClass('minimize');
            $('.legend-arrow i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
            $(this).removeClass('minimize')
              .parent().find('.legend-arrow i')
              .removeClass('fa-chevron-down')
              .addClass('fa-chevron-up');
          } else {
            $(this).addClass('minimize');
            $(this).parent().find('.legend-arrow i')
              .removeClass('fa-chevron-up')
              .addClass('fa-chevron-down');
          }
        });

        $('.ladder h6').first().click();

        $('#map').css('visibility', 'visible');
        $('.loader').hide();
    
        // Open intro popup window in the center of the map
        if (getSetting('_introPopupText') != '') {
          initIntroPopup(getSetting('_introPopupText'), map.getCenter());
          setTimeout(function() {
            map.closePopup();
          }, 7000);
        }

        togglePolygonLabels();
      } else {
        setTimeout(showMap, 50);
      }
    }
    
    // Add Google Analytics if the ID exists
    var ga = getSetting('_googleAnalytics');
    console.log(ga)
    if ( ga && ga.length >= 10 ) {
      var gaScript = document.createElement('script');
      gaScript.setAttribute('src','https://www.googletagmanager.com/gtag/js?id=' + ga);
      document.head.appendChild(gaScript);
  
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', ga);
    }
  }

  /**
   * Adds title and subtitle from the spreadsheet to the map
   */
  function addTitle() {
    var dispTitle = getSetting('_mapTitleDisplay');

    if (dispTitle !== 'off') {
      var title = '<h3 class="pointer">' + getSetting('_mapTitle') + '</h3>';
      var subtitle = '<h5>' + getSetting('_mapSubtitle') + '</h5>';

      if (dispTitle == 'topleft') {
        $('div.leaflet-top').prepend('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      } else if (dispTitle == 'topcenter') {
        $('#map').append('<div class="div-center"></div>');
        $('.div-center').append('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      }

      $('.map-title h3').click(function() { location.reload(); });
    }
  }


  /**
   * Adds polylines to the map
   */
  function processPolylines(p) {
    if (!p || p.length == 0) return;

    var pos = (getSetting('_polylinesLegendPos') == 'off')
      ? 'topleft'
      : getSetting('_polylinesLegendPos');

    var polylinesLegend = L.control.layers(null, null, {
      position: pos,
      collapsed: false,
    });

    for (i = 0; i < p.length; i++) {
      $.getJSON(p[i]['GeoJSON URL'], function(index) {
        return function(data) {
          latlng = [];

          for (l in data['features']) {
            latlng.push(data['features'][l].geometry.coordinates);
          }

          // Reverse [lon, lat] to [lat, lon] for each point
          for (l in latlng) {
            for (c in latlng[l]) {
              latlng[l][c].reverse();
              // If coords contained 'z' (altitude), remove it
              if (latlng[l][c].length == 3) {
                latlng[l][c].shift();
              }
            }
          }

          line = L.polyline(latlng, {
            color: (p[index]['Color'] == '') ? 'grey' : p[index]['Color'],
            weight: trySetting('_polylinesWeight', 2),
            pane: 'shadowPane'
          });

          if (p[index]['Description'] && p[index]['Description'] != '') {
            line.bindPopup(p[index]['Description']);
          }

          polylinesLegend.addOverlay(line,
            '<i class="color-line" style="background-color:' + p[index]['Color']
            + '"></i> ' + p[index]['Display Name']);

          if (index == 0) {
            if (polylinesLegend._container) {
              polylinesLegend._container.id = 'polylines-legend';
              polylinesLegend._container.className += ' ladder';
            }

            if (getSetting('_polylinesLegendTitle') != '') {
              $('#polylines-legend').prepend('<h6 class="pointer">' + getSetting('_polylinesLegendTitle') + '</h6>');
              if (getSetting('_polylinesLegendIcon') != '') {
                $('#polylines-legend h6').prepend('<span class="legend-icon"><i class="fas '
                  + getSetting('_polylinesLegendIcon') + '"></i></span>');
              }

              // Add map title if set to be displayed in polylines legend
              if (getSetting('_mapTitleDisplay') == 'in polylines legend') {
                var title = '<h3>' + getSetting('_mapTitle') + '</h3>';
                var subtitle = '<h6>' + getSetting('_mapSubtitle') + '</h6>';
                $('#polylines-legend').prepend(title + subtitle);
              }
            }
          }

          if (p.length == index + 1) {
            completePolylines = true;
          }
        };
      }(i));
    }

    if (getSetting('_polylinesLegendPos') !== 'off') {
      polylinesLegend.addTo(map);
    }
  }

 function initIntroPopup(info, coordinates) {
    // This is a pop-up for mobile device
    if (window.matchMedia("only screen and (max-width: 760px)").matches) {
      $('body').append('<div id="mobile-intro-popup"><p>' + info +
        '</p><div id="mobile-intro-popup-close"><i class="fas fa-times"></i></div></div>');

      $('#mobile-intro-popup-close').click(function() {
        $("#mobile-intro-popup").hide();
      });
      return;
    }
 

    /* And this is a standard popup for bigger screens */
    L.popup({className: 'intro-popup'})
      .setLatLng(coordinates) // this needs to change
      .setContent(info)
      .openOn(map);
  }

  /**
   * Turns on and off polygon text labels depending on current map zoom
   */
  function togglePolygonLabels() {
    for (i in allTextLabels) {
      if (map.getZoom() <= tryPolygonSetting(i, '_polygonLabelZoomLevel', 9)) {
        $('.polygon-label' + i).hide();
      } else {
        if ($('.polygons-legend' + i + ' input[name=prop]:checked').val() != '-1') {
          $('.polygon-label' + i).show();
        }
      }
    }
  }

  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'View <a href="' + 'https://www.cred-eg.com/' + '" target="_blank">Data</a>';
    var name = getSetting('_authorName');
    var url = getSetting('_authorURL');

    if (name && url) {
      if (url.indexOf('@') > 0) { url = 'mailto:' + url; }
      credit += ' by <a href="' + url + '">' + name + '</a> | ';
    } else if (name) {
      credit += ' by ' + name + ' | ';
    } else {
      credit += ' | ';
    }

    credit += 'View <a href="' + getSetting('_githubRepo') + '">Code</a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit;
  }

  /*Loads the basemap and adds it to the map*/

    function addBaseMap() {
    var basemap = trySetting('_tileProvider', 'Esri.WorldImagery');
    L.tileLayer.provider(basemap, {
      maxZoom: 18
    }).addTo(map);
    L.control.attribution().setPosition('bottomright').addTo(map);
    L.control.layers(baseMaps, overlayMaps).setPosition('bottomright').addTo(map);
    L.control.ruler(options).addTo(map);


    // Custom Leaflet control for the Draw button
L.Control.DrawButton = L.Control.extend({
    options: {
        position: 'bottomright' // Same position as the search control
    },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-control-draw leaflet-control');
        container.innerHTML = '<a class="draw-button" href="#" title="Toggle Draw Mode"><i class="material-icons">edit</i></a>';

        // Prevent map interactions when clicking the button
        L.DomEvent.disableClickPropagation(container);

        // Toggle drawing mode on click
        L.DomEvent.on(container, 'click', function () {
            if (isDrawingMode) {
                isDrawingMode = false;
                container.style.backgroundColor = '#ffffff'; // Default color
                map.dragging.enable();
                drawnLines = [];
                drawLayer.clearLayers();
            } else {
                isDrawingMode = true;
                container.style.backgroundColor = 'red'; // Active color
                map.dragging.disable();
            }
        });

        return container;
    }
});

// Add the Draw control to the map
var drawControl = new L.Control.DrawButton();
map.addControl(drawControl);

        // Add location control
    if (getSetting('_mapMyLocation') !== 'off') {
      var locationControl = L.control.locate({
        keepCurrentZoomLevel: true,
        returnToPrevBounds: true,
        position: getSetting('_mapMyLocation')
      }).addTo(map);
    }

    // Add zoom control
    if (getSetting('_mapZoom') !== 'off') {
      L.control.zoom({position: getSetting('_mapZoom')}).addTo(map);
    }

    map.on('zoomend', function() {
      togglePolygonLabels();
    });
       addTitle();
 
    //control search
    const searchControl = new L.Control.Search({
      layer: searchLayer,
      zoom: "13",
      propertyName: 'Project'
    }).setPosition('bottomright');
    map.addControl(searchControl);
    map.removeLayer(searchLayer);
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getPolygonSetting(p, s) {
    if (polygonSettings[p]) {
      return polygonSettings[p][constants[s]];
    }
    return false;
  }

  /**
   * Returns the value of setting named s from constants.js
   * or def if setting is either not set or does not exist
   * Both arguments are strings
   * e.g. trySetting('_authorName', 'No Author')
   */
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }

  function tryPolygonSetting(p, s, def) {
    s = getPolygonSetting(p, s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }

  /**
   * Triggers the load of the spreadsheet and map creation
   */
   var mapData;

   $.ajax({
       url:'./csv/Options.csv',
       type:'HEAD',
       error: function() {
         // Options.csv does not exist in the root level, so use Tabletop to fetch data from
         // the Google sheet

         if (typeof googleApiKey !== 'undefined' && googleApiKey) {

          var parse = function(res) {
            return Papa.parse(Papa.unparse(res[0].values), {header: true} ).data;
          }

          var apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets/'
          var spreadsheetId = googleDocURL.indexOf('/d/') > 0
            ? googleDocURL.split('/d/')[1].split('/')[0]
            : googleDocURL

          $.getJSON(
            apiUrl + spreadsheetId + '?key=' + googleApiKey
          ).then(function(data) {
              var sheets = data.sheets.map(function(o) { return o.properties.title })

              if (sheets.length === 0 || !sheets.includes('Options')) {
                'Could not load data from the Google Sheet'
              }

              // First, read 3 sheets: Options, Points, and Polylines
              $.when(
                $.getJSON(apiUrl + spreadsheetId + '/values/Options?key=' + googleApiKey),
                $.getJSON(apiUrl + spreadsheetId + '/values/Points?key=' + googleApiKey),
                $.getJSON(apiUrl + spreadsheetId + '/values/Polylines?key=' + googleApiKey)
              ).done(function(options, points, polylines) {

                // Which sheet names contain polygon data?
                var polygonSheets = sheets.filter(function(name) { return name.indexOf('Polygons') === 0})

                // Define a recursive function to fetch data from a polygon sheet
                var fetchPolygonsSheet = function(polygonSheets) {

                  // Load map once all polygon sheets have been loaded (if any)
                  if (polygonSheets.length === 0) {
                    onMapDataLoad(
                      parse(options),
                      parse(points),
                      parse(polylines)
                    )
                  } else {
                    
                    // Fetch another polygons sheet
                    $.getJSON(apiUrl + spreadsheetId + '/values/' + polygonSheets.shift() + '?key=' + googleApiKey, function(data) {
                      createPolygonSettings( parse([data]) )
                      fetchPolygonsSheet(polygonSheets)
                    })

                  }

                }

                // Start recursive function
                fetchPolygonsSheet( polygonSheets )

              })
              
            }
          )

         } else {
          alert('You load data from a Google Sheet, you need to add a free Google API key')
         }

       },

       /*
       Loading data from CSV files.
       */
       success: function() {

        var parse = function(s) {
          return Papa.parse(s[0], {header: true}).data
        }
      
        $.when(
          $.get('./csv/Options.csv'),
          $.get('./csv/Points.csv'),
          $.get('./csv/Polylines.csv')
        ).done(function(options, points, polylines) {
      
          function loadPolygonCsv(n) {
      
            $.get('./csv/Polygons' + (n === 0 ? '' : n) + '.csv', function(data) {
              createPolygonSettings( parse([data]) )
              loadPolygonCsv(n+1)
            }).fail(function() { 
              // No more sheets to load, initialize the map  
              onMapDataLoad( parse(options), parse(points), parse(polylines) )
            })
      
          }
      
          loadPolygonCsv(0)
      
        })

       }
   });

  /**
   * Reformulates documentSettings as a dictionary, e.g.
   * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
   */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }

  /**
   * Reformulates polygonSettings as a dictionary, e.g.
   * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
   */
  function createPolygonSettings(settings) {
    var p = {};
    for (var i in settings) {
      var setting = settings[i];
      p[setting.Setting] = setting.Customize;
    }
    polygonSettings.push(p);
  }

  // Returns a string that contains digits of val split by comma evey 3 positions
  // Example: 12345678 -> "12,345,678"
  function comma(val) {
      while (/(\d+)(\d{3})/.test(val.toString())) {
          val = val.toString().replace(/(\d+)(\d{3})/, '$1' + ',' + '$2');
      }
      return val;
  }

});
