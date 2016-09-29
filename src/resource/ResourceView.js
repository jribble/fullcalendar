// this needs a custom scrollParent so we find the hidden scrollable
$.fn.extend({
    scrollParent: function() {
        var position = this.css( "position" ),
            excludeStaticParent = position === "absolute",
            scrollParent = this.parents().filter( function() {
                var parent = $( this );
                if ( excludeStaticParent && parent.css( "position" ) === "static" && parent.css( "float" ) === "none" ) {
                    return false;
                }
                return (/(auto|scroll|hidden)/).test( parent.css( "overflow" ) + parent.css( "overflow-y" ) + parent.css( "overflow-x" ) );
            }).eq( 0 );

        return position === "fixed" || !scrollParent.length ? $( this[ 0 ].ownerDocument || document ) : scrollParent;
    }
});

setDefaults({
    allDaySlot: true,
    allDayText: 'all-day',
    firstHour: 6,
    slotMinutes: 30,
    defaultEventMinutes: 120,
    axisFormat: 'h(:mm)tt',
    timeFormat: {
        agenda: 'h:mm{ - h:mm}'
    },
    dragOpacity: {
        agenda: .5
    },
    minTime: 0,
    maxTime: 24,
	slotEventOverlap: true
});


// TODO: make it work in quirks mode (event corners, all-day height)
// TODO: test liquid width, especially in IE6


function ResourceView(element, calendar, viewName) {
    var t = this;
	
	
    // exports
    t.renderResource = renderResource;
    t.rerenderFooter = rerenderFooter;
    t.setWidth = setWidth;
    t.setHeight = setHeight;
	t.afterRender = afterRender;
    t.defaultEventEnd = defaultEventEnd;
    t.timePosition = timePosition;
	t.getIsCellAllDay = getIsCellAllDay;
    t.allDayRow = getAllDayRow;
	t.getCoordinateGrid = function() { return coordinateGrid }; // specifically for AgendaEventRenderer
    t.getHoverListener = function() { return hoverListener };
	t.colLeft = colLeft;
	t.colRight = colRight;
    t.colContentLeft = colContentLeft;
    t.colContentRight = colContentRight;
    t.getDaySegmentContainer = function() { return daySegmentContainer };
    t.getHighlightSegmentContainer = function() { return highlightSegmentContainer };
    t.getSlotSegmentContainer = function() { return slotSegmentContainer };
    t.getMinMinute = function() { return minMinute };
    t.getMaxMinute = function() { return maxMinute };
	t.getSlotContainer = function() { return slotContainer };
    t.getRowCnt = function() { if(allDayAxis) return 2; else return 1; };
    t.getColCnt = function() { return colCnt };
    t.getColWidth = function() { return colWidth };
	t.getSnapHeight = function() { return snapHeight };
	t.getSnapMinutes = function() { return snapMinutes };
    t.defaultSelectionEnd = defaultSelectionEnd;
    t.renderDayOverlay = renderDayOverlay;
    t.renderSelection = renderSelection;
    t.clearSelection = clearSelection;
    t.reportDayClick = reportDayClick; // selection mousedown hack
    t.dragStart = dragStart;
    t.dragStop = dragStop;
    t.colToResource = colToResource;
    t.resetScroll = resetScroll;
    t.resources = calendar.fetchResources();
    
	
    // imports
    View.call(t, element, calendar, viewName);

    // overrides
    t.cellToDate = cellToDate;

    OverlayManager.call(t);
    SelectionManager.call(t);
    ResourceEventRenderer.call(t);


    var opt = t.opt;
    var trigger = t.trigger;
    var renderOverlay = t.renderOverlay;
    var clearOverlays = t.clearOverlays;
    var reportSelection = t.reportSelection;
    var unselect = t.unselect;
    //overridden elsewhere
	//var daySelectionMousedown = t.daySelectionMousedown;
    var slotSegHtml = t.slotSegHtml;
	var cellToDate = t.cellToDate;
	var dateToCell = t.dateToCell;
	var rangeToSegments = t.rangeToSegments;
    var formatDate = calendar.formatDate;
    var renderHighlights = t.renderHighlights;
    
    
    // locals

    var axisTable;
    var dayScroller;
    var dayTable;
    var gutterTable;
    var dayHead;
    var dayHeadCells;
    var resourceHead;
    var resourceHeadCells;
    var resourceFoot;
    var resourceFootCells;
    var dayBody;
    var dayBodyCells;
    var dayBodyCellInners;
	var dayBodyCellContentInners;
    var dayBodyFirstCell;
    var dayBodyFirstCellStretcher;
    var slotLayer;
    var daySegmentContainer;
    var allDayAxis;
    var allDayScroller;
    var allDayTable;
    var allDayGutter;
    var allDayRow;
    var axisSlotTable;
    var axisScroller;
    var slotScroller;
	var slotContainer;
    var highlightSegmentContainer;
    var slotSegmentContainer;
    var slotTable;
    var selectionHelper;
	
    var viewWidth;
    var viewHeight;
    var axisWidth;
    var colMinWidth;
    var colWidth;
    var gutterWidth;
    var slotHeight; // TODO: what if slotHeight changes? (see issue 650)
	
	var snapMinutes;
	var snapRatio; // ratio of number of "selection" slots to normal slots. (ex: 1, 2, 4)
	var snapHeight; // holds the pixel hight of a "selection" slot

    var colCnt;
    var slotCnt;
    var coordinateGrid;
    var hoverListener;
	var colPositions;
    var colContentPositions;
    var slotTopCache = {};

    var tm;
	var rtl;
    var minMinute, maxMinute;
    var colFormat;
    var resources = t.resources;
    var highlights = t.highlights;
    var showWeekNumbers;
    var weekNumberTitle;
    var weekNumberFormat;
    


    /* Rendering
	-----------------------------------------------------------------------------*/
	
	
    disableTextSelection(element.addClass('fc-agenda'));

	
    function renderResource(days) {
        if(days==null) days = [t.start];
        resources = t.resources = calendar.fetchResources();
        if(resources==null||resources.length==0) resources = [{name:"",id:""}];
        t.days = days;
        colCnt = resources.length * days.length;
        updateOptions();

        if (!dayTable) {
			buildSkeleton(); // builds day table, slot area, events containers
        }else{
			buildDayTable(); // rebuilds day table
        }

    }
	

    function updateOptions() {

        tm = opt('theme') ? 'ui' : 'fc';
		rtl = opt('isRTL');
        minMinute = parseTime(opt('minTime'));
        maxMinute = parseTime(opt('maxTime'));
        colFormat = opt('columnFormat');
        colMinWidth = opt('colMinWidth');

        var newSlotHeight = opt('slotHeight');
        if(newSlotHeight != null && newSlotHeight != slotHeight && dayTable != null) {
            $("table.fc-agenda-slots tr", element).height(newSlotHeight);
        }
        slotHeight = newSlotHeight;

        // week # options. (TODO: bad, logic also in other views)
        showWeekNumbers = opt('weekNumbers');
        weekNumberTitle = opt('weekNumberTitle');
        if (opt('weekNumberCalculation') != 'iso') {
            weekNumberFormat = "w";
        }
        else {
            weekNumberFormat = "W";
        }

		snapMinutes = opt('snapMinutes') || opt('slotMinutes');
    }

    function rerenderFooter(date, resourceId) {
        // trigger events for resource column footers
        var _resourceId = resourceId === null ? "null" : resourceId;
        var dateString = moment(date).format("YYYY-MM-DD");
        var footths = dayTable.find('tfoot th[data-resource-id="' + _resourceId + '" ][data-date="' + dateString + '"]');
        footths.each(function(index, element) {
            var el = $(element);
            el.html('&nbsp;');
            trigger('footerRender', el, resourceId, el);
        });
    }
	
	
	
	/* Build DOM
	-----------------------------------------------------------------------*/


    function buildSkeleton() {
        var headerClass = tm + "-widget-header";
        var contentClass = tm + "-widget-content";
        var s;
        var d;
        var i;
        var maxd;
        var minutes;
        var slotNormal = opt('slotMinutes') % 15 == 0;

        var html = buildDayAxisHTML();

        axisTable = $(html).appendTo(element);

        if (dayScroller) {
            dayScroller.remove();
        }

        dayScroller = $("<div style='width: 100%; float:left; overflow-x:hidden;'/>")
            .appendTo(element);

        html = buildDayGutterHTML();
        gutterTable = $(html).appendTo(element);

        buildDayTable();

        $("<div style='clear:both;'/>").appendTo(element);

        slotLayer =
            $("<div style='position:absolute;z-index:2;left:0;width:100%'/>")
                .appendTo(element);

        if (opt('allDaySlot')) {

            s =
                "<table style='width:0px;float:left;' class='fc-agenda-allday' cellspacing='0'>" +
                "<tr>" +
                "<th class='" + headerClass + " fc-agenda-axis'><div class='fc-day-content' style='padding:0;'><div>" + opt('allDayText') + "</div></div></th>" +
                "</tr>" +
                "</table>";
            allDayAxis = $(s).appendTo(slotLayer);

            allDayScroller = $("<div style='width:100%; float:left; overflow-x:hidden;'/>")
                .appendTo(slotLayer);

            daySegmentContainer =
                $("<div class='fc-event-container' style='position:relative;z-index:8;top:0;left:0'/>")
                    .appendTo(allDayScroller);

            s =
                "<table style='width:100%;' class='fc-agenda-allday' cellspacing='0'>" +
                "<tr>" +
                "<td>" +
                "<div class='fc-day-content'><div style='position:relative'/></div>" +
                "</td>" +
                "</tr>" +
                "</table>";
            allDayTable = $(s).appendTo(allDayScroller);
            allDayRow = allDayTable.find('tr');

            dayBind(allDayRow.find('td'));


            s =
                "<table style='width:0px;float:left;' class='fc-agenda-allday' cellspacing='0'>" +
                "<tr>" +
                "<th class='" + headerClass + " fc-agenda-gutter'><div class='fc-day-content' style='padding:0;'><div>&nbsp;</div></div></th>" +
                "</tr>" +
                "</table>";
            allDayGutter = $(s).appendTo(slotLayer);

            slotLayer.append(
                    "<div class='fc-agenda-divider " + headerClass + "' style='clear:both;'>" +
                    "<div class='fc-agenda-divider-inner'/>" +
                    "</div>"
            );

        }else{

            daySegmentContainer = $([]); // in jQuery 1.4, we can just do $()

        }

        axisScroller =
            $("<div class='fc-axis-scroller' style='position:relative;width:0px;float:left;overflow-y:hidden'/>")
                .appendTo(slotLayer);

        s =
            "<table class='fc-agenda-slots' style='width:0px;float:left;' cellspacing='0'>" +
            "<tbody>";
        d = zeroDate();
        maxd = addMinutes(cloneDate(d), maxMinute);
        addMinutes(d, minMinute);
        slotCnt = 0;
        for (i=0; d < maxd; i++) {
            minutes = d.getMinutes();
            s +=
                "<tr class='fc-slot" + i + ' ' + (!minutes ? '' : 'fc-minor') + "'" + ( slotHeight != null ? " style='height:" + slotHeight + "px'" : "" ) + ">" +
                "<th class='fc-agenda-axis " + headerClass + "'>" +
                "<div style='position:relative;'>" +
                ((!slotNormal || !minutes) ? formatDate(d, opt('axisFormat')) : '&nbsp;') +
                "</div>" +
                "</th>" +
                "</tr>";
            addMinutes(d, opt('slotMinutes'));
            slotCnt++;
        }
        s +=
            "</tbody>" +
            "</table>";

        axisSlotTable = $(s).appendTo(axisScroller);

        slotScroller =
            $("<div style='position:relative;width:100%;float:left;overflow-x:auto;overflow-y:auto'/>")
                .appendTo(slotLayer);

        $("<div style='clear:both;'/>").appendTo(slotLayer);

        slotContainer =
            $("<div style='position:relative;width:100%'/>")
                .appendTo(slotScroller);

        highlightSegmentContainer =
            $("<div class='fc-highlight-container' style='position:absolute;z-index:-1;top:0;left:0'/>")
                .appendTo(slotContainer);

        slotSegmentContainer =
            $("<div class='fc-event-container' style='position:absolute;z-index:8;top:0;left:0'/>")
                .appendTo(slotContainer);

        s =
            "<table class='fc-agenda-slots' style='width:100%' cellspacing='0'>" +
            "<tbody>";
        d = zeroDate();
        maxd = addMinutes(cloneDate(d), maxMinute);
        addMinutes(d, minMinute);
        slotCnt = 0;
        for (i=0; d < maxd; i++) {
            minutes = d.getMinutes();
            s +=
                "<tr class='fc-slot" + i + ' ' + (!minutes ? '' : 'fc-minor') + "'" + ( slotHeight != null ? " style='height:" + slotHeight + "px'" : "" ) + ">" +
                "<td class='" + contentClass + "'>" +
                "<div style='position:relative'>&nbsp;</div>" +
                "</td>" +
                "</tr>";
            addMinutes(d, opt('slotMinutes'));
            slotCnt++;
        }
        s +=
            "</tbody>" +
            "</table>";
        slotTable = $(s).appendTo(slotContainer);

        slotBind(slotTable.find('td'));

        slotScroller.scroll(function() {
            dayScroller.scrollLeft(slotScroller.scrollLeft());
            axisScroller.scrollTop(slotScroller.scrollTop());
            if(allDayScroller) allDayScroller.scrollLeft(slotScroller.scrollLeft());
        });

        if(allDayScroller) {
            allDayScroller.scroll(function() {
                slotScroller.scrollLeft(allDayScroller.scrollLeft());
                dayScroller.scrollLeft(allDayScroller.scrollLeft());
            })
        }
    }



    /* Build Day Table
     -----------------------------------------------------------------------*/


    function buildDayTable() {
        var html = buildDayTableHTML();

        if (dayTable) {
            dayTable.remove();
        }
        dayTable = $(html).appendTo(dayScroller);

        dayHead = dayTable.find('thead');
        dayHeadCells = dayHead.find('tr:eq(0) th');
        resourceHead = dayTable.find('thead tr:eq(1)');
        resourceHeadCells = resourceHead.find('th');
        resourceFoot = dayTable.find('tfoot');
        resourceFootCells = resourceFoot.find('tr:eq(0) td');
        dayBody = dayTable.find('tbody');
        dayBodyCells = dayBody.find('td');
        dayBodyCellInners = dayBodyCells.find('> div');
        dayBodyCellContentInners = dayBodyCells.find('.fc-day-content > div');

        dayBodyFirstCell = dayBodyCells.eq(0);
        dayBodyFirstCellStretcher = dayBodyCellInners.eq(0);

        markFirstLast(dayHead.add(dayHead));
        markFirstLast(dayHead.add(dayHead.find('tr:eq(0)')));
        markFirstLast(resourceHead.add(resourceHead));
        markFirstLast(dayBody.add(dayBody.find('tr')));

        // trigger events for day column headers
        var dayths = dayTable.find('th[data-date]:not([data-resource-id])');
        dayths.each(function(index, element) {
            var date = $.attr(element, 'data-date');
            var el = $(element);
            trigger('dayRender', el, moment(date).toDate(), el);
        });

        // trigger events for resource column headers
        var resths = dayTable.find('thead th[data-resource-id]');
        resths.each(function(index, element) {
            var resourceId = $.attr(element, 'data-resource-id');
            if(resourceId === "null") resourceId = null;
            var el = $(element);
            trigger('resourceRender', el, resourceId, el);
        });

        // trigger events for resource column footers
        var footths = dayTable.find('tfoot th[data-resource-id]');
        footths.each(function(index, element) {
            var resourceId = $.attr(element, 'data-resource-id');
            if(resourceId === "null") resourceId = null;
            var el = $(element);
            trigger('footerRender', el, resourceId, el);
        });


        // TODO: now that we rebuild the cells every time, we should call dayRender
    }


    function buildDayAxisHTML() {
        var html =
            "<table style='width:100%; float:left;' class='fc-agenda-days fc-agenda-days-axis fc-border-separate' cellspacing='0'>" +
            buildDayAxisHeadHTML() +
            buildDayAxisBodyHTML() +
            "</table>";

        return html;
    }


    function buildDayAxisHeadHTML() {
        var headerClass = tm + "-widget-header";
        var date;
        var html = '';
        var weekText;

        html +=
            "<thead>" +
            "<tr>";

        if (showWeekNumbers) {
            date = cellToDate(0, 0);
            weekText = formatDate(date, weekNumberFormat);
            if (rtl) {
                weekText += weekNumberTitle;
            }
            else {
                weekText = weekNumberTitle + weekText;
            }
            html +=
                "<th class='fc-agenda-axis fc-week-number " + headerClass + "'>" +
                htmlEscape(weekText) +
                "</th>";
        }
        else {
            html += "<th class='fc-agenda-axis " + headerClass + "'>&nbsp;</th>";
        }
        html +=
            "</tr>" +
            "</thead>";

        return html;
    }


    function buildDayAxisBodyHTML() {
        var headerClass = tm + "-widget-header"; // TODO: make these when updateOptions() called
        var html = '';

        html +=
            "<tbody>" +
            "<tr>" +
            "<th class='fc-agenda-axis " + headerClass + "'>&nbsp;</th>";

        html +=
            "</tr>" +
            "</tbody>";

        return html;
    }


    function buildDayTableHTML() {
        var showFooter = opt('showFooter');
        var html =
            "<table style='width:100%;position:relative;' class='fc-agenda-days fc-border-separate' cellspacing='0'>" +
            buildDayTableHeadHTML() +
            buildDayTableBodyHTML() +
            (!!showFooter ? buildDayTableFootHTML() : "") +
            "</table>";

        return html;
    }


    function buildDayTableHeadHTML() {
        var headerClass = tm + "-widget-header";
        var date;
        var today = moment(clearTime(new Date()));
        var html = '';
        var col;

        html +=
            "<thead>" +
            "<tr>";

        var days = Math.ceil(colCnt / resources.length);
        for (var i=0; i<days; i++) {
            var col = i * resources.length;
            date = cellToDate(0, col);
            html +=
                "<th class='fc-" + dayIDs[date.getDay()] + " fc-col" + col + ' '  + headerClass + (today.isSame(date, 'day') ? ' fc-col-today' : '') + "' colspan=" + resources.length + " data-date='" + moment(date).format("YYYY-MM-DD") + "' >" +
                htmlEscape(formatDate(date, colFormat)) +
                "</th>";
        }

        html +=
            "</tr>" +
            "<tr>";
        for (var col=0; col<colCnt; col++) {
            var resource = resources[col % resources.length];
            date = cellToDate(0, col);
            html +=
                "<th class='fc-" + dayIDs[date.getDay()] + " fc-col" + col + ' ' + headerClass + "'" + (colMinWidth ? "style='min-width:" + colMinWidth + "px;'" : "" ) + " data-date='" + moment(date).format("YYYY-MM-DD") + "' data-resource-id='" + resource.id + "' >" +
                (resource.name == "" ? "&nbsp;" : htmlEscape(resource.name)) +
                "</th>";
        }
        html +=
            "</tr>" +
            "</thead>";

        return html;
    }


    function buildDayTableBodyHTML() {
        var headerClass = tm + "-widget-header"; // TODO: make these when updateOptions() called
        var contentClass = tm + "-widget-content";
        var date;
        var today = clearTime(new Date());
        var col;
        var cellsHTML;
        var cellHTML;
        var classNames;
        var html = '';

        html +=
            "<tbody>" +
            "<tr>";

        cellsHTML = '';

        for (col=0; col<colCnt; col++) {

            date = cellToDate(0, col);

            classNames = [
                    'fc-col' + col,
                    'fc-' + dayIDs[date.getDay()],
                contentClass
            ];
            if (+date == +today) {
                classNames.push(
                        tm + '-state-highlight',
                    'fc-today'
                );
            }
			else if (date < today) {
				classNames.push('fc-past');
			}
			else {
				classNames.push('fc-future');
			}

            cellHTML =
                "<td class='" + classNames.join(' ') + "'>" +
                "<div>" +
                "<div class='fc-day-content'>" +
                "<div style='position:relative'>&nbsp;</div>" +
                "</div>" +
                "</div>" +
                "</td>";

            cellsHTML += cellHTML;
        }

        html += cellsHTML;
        html +=
            "</tr>" +
            "</tbody>";

        return html;
    }


    function buildDayTableFootHTML() {
        var headerClass = tm + "-widget-header";
        var date;
        var today = moment(clearTime(new Date()));
        var html = '';
        var col;

        html +=
            "<tfoot>" +
            "<tr>";

        for (var col=0; col<colCnt; col++) {
            var resource = resources[col % resources.length];
            date = cellToDate(0, col);
            html +=
                "<th class='fc-" + dayIDs[date.getDay()] + " fc-col" + col + ' ' + headerClass + "'" + (colMinWidth ? "style='min-width:" + colMinWidth + "px;'" : "" ) + " data-date='" + moment(date).format("YYYY-MM-DD") + "' data-resource-id='" + resource.id + "' >" +
                "&nbsp;" + //(resource.name == "" ? "&nbsp;" : htmlEscape(resource.name)) +
                "</th>";
        }

        html +=
            "</tr>" +
            "</tfoot>";

        return html;
    }


    function buildDayGutterHTML() {
        var headerClass = tm + "-widget-header";
        var html =
            "<table style='width:100%; float:left;' class='fc-agenda-days fc-agenda-days-axis fc-border-separate' cellspacing='0'>";

        html +=
            "<thead>" +
            "<tr>" +
            "<th class='fc-agenda-gutter " + headerClass + "'>&nbsp;</th>" +
            "</tr>" +
            "<tr>" +
            "<th class='fc-agenda-gutter " + headerClass + "'>&nbsp;</th>" +
            "</tr>" +
            "</thead>"
            "<tbody>" +
            "<tr>" +
            "<th class='fc-agenda-gutter " + headerClass + "'>&nbsp;</th>" +
            "</tr>" +
            "</tbody>";

        return html;
    }


    // TODO: data-date on the cells



	/* Dimensions
	-----------------------------------------------------------------------*/


	function setHeight(height) {
        if (height === undefined) {
            height = viewHeight;
        }
        viewHeight = height;
        slotTopCache = {};
	
        var headHeight = dayBody.position().top;
        var allDayHeight = slotScroller.position().top; // including divider
        var bodyHeight = Math.min( // total body height, including borders
            height - headHeight,   // when scrollbars
            slotTable.height() + allDayHeight + 1 // when no scrollbars. +1 for bottom border
            );
        var footerHeight = resourceFoot.height();
		
        dayBodyFirstCellStretcher
        .height(bodyHeight - vsides(dayBodyFirstCell) - footerHeight);
		
        slotLayer.css('top', headHeight);

        var slotTableHeight = slotScroller[0].clientHeight;
        var gutterHeight = slotScroller.height() - slotTableHeight;

        axisScroller.height(bodyHeight - allDayHeight - 1 - gutterHeight - footerHeight);
        slotScroller.height(bodyHeight - allDayHeight - 1 - footerHeight);
		
		// the stylesheet guarantees that the first row has no border.
		// this allows .height() to work well cross-browser.
        if(slotHeight == null) {
            slotHeight = slotTable.find('tr:first').height() + 1; // +1 for bottom border
        }
		
		snapRatio = opt('slotMinutes') / snapMinutes;
		snapHeight = slotHeight / snapRatio;
    }
	

    function setWidth(width) {
        viewWidth = width;
		colPositions.clear();
        colContentPositions.clear();
		
//		var axisFirstCells = axisTable.find('th:first');
		var axisFirstCells = axisSlotTable.find('th:first');
		if (allDayAxis) {
			axisFirstCells = axisFirstCells.add(allDayAxis.find('th:first'));
		}

        axisWidth = 0;
        setOuterWidth(
            axisFirstCells
            .width('')
            .each(function(i, _cell) {
                axisWidth = Math.max(axisWidth, $(_cell).outerWidth());
            }),
            axisWidth
            );
		
		var gutterCells = dayTable.find('.fc-agenda-gutter');
		if (allDayTable) {
			gutterCells = gutterCells.add(allDayTable.find('th.fc-agenda-gutter'));
		}

        var slotTableWidth = slotScroller[0].clientWidth; // needs to be done after axisWidth (for IE7)
		
        gutterWidth = slotScroller.width() - slotTableWidth;
        if (gutterWidth) {
            setOuterWidth(gutterCells, gutterWidth);
            gutterCells
            .show()
            .prev()
            .removeClass('fc-last');
        }else{
            gutterCells
            .hide()
            .prev()
            .addClass('fc-last');
        }
		
        colWidth = Math.floor(slotTableWidth / colCnt);
        //TODO: Make this configurable
        if(colMinWidth && colWidth < colMinWidth) colWidth = colMinWidth;
        setOuterWidth(resourceHeadCells.slice(0, -1), colWidth);

        axisScroller.width(axisWidth);
        axisTable.width(axisWidth);
        axisSlotTable.width(axisWidth);
        dayScroller.width(viewWidth - axisWidth - gutterWidth);
        slotScroller.width(viewWidth - axisWidth);
        gutterTable.width(gutterWidth);

        var tableWidth = (colWidth * colCnt);
        dayTable.width(tableWidth);

        if(allDayTable) allDayTable.width(tableWidth);
        if(daySegmentContainer) daySegmentContainer.width(tableWidth);
        if(allDayScroller) allDayScroller.width(viewWidth - axisWidth - gutterWidth);
        if(allDayAxis) allDayAxis.width(axisWidth);
        if(allDayGutter) allDayGutter.width(gutterWidth);

        var slotContainerWidth = tableWidth;
        slotContainer.width(slotContainerWidth);
    }


	/* Scrolling
	-----------------------------------------------------------------------*/


    function resetScroll() {
        if (!!slotTable) {
	    var d0 = zeroDate();
            var scrollDate = cloneDate(d0);
            scrollDate.setHours(opt('firstHour'));
            var top = timePosition(d0, scrollDate) + 1; // +1 for the border
            function scroll() {
                axisScroller.scrollTop(top);
                slotScroller.scrollTop(top);
            }
            scroll();
            setTimeout(scroll, 0); // overrides any previous scroll state made by the browser
	}    
    }
	
	
	function afterRender() { // after the view has been freshly rendered and sized
		//resetScroll();
    }
	


    /* Slot/Day clicking and binding
	-----------------------------------------------------------------------*/
	

    function dayBind(cells) {
        cells.click(slotClick)
        .mousedown(daySelectionMousedown);
    }


    function slotBind(cells) {
        cells.click(slotClick)
        .mousedown(slotSelectionMousedown);
    }
	
	
    function slotClick(ev) {
        if (!opt('selectable')) { // if selectable, SelectionManager will worry about dayClick
            var col = Math.min(colCnt-1, Math.floor((ev.pageX - dayTable.offset().left - axisWidth) / colWidth));
			var date = cellToDate(0, col);
            var rowMatch = this.parentNode.className.match(/fc-slot(\d+)/); // TODO: maybe use data
            if (rowMatch) {
                var mins = parseInt(rowMatch[1]) * opt('slotMinutes');
                var hours = Math.floor(mins/60);
                date.setHours(hours);
                date.setMinutes(mins%60 + minMinute);
                trigger('dayClick', dayBodyCells[col], date, false, ev);
            }else{
                trigger('dayClick', dayBodyCells[col], date, true, ev);
            }
        }
    }
	
	
	
    /* Semi-transparent Overlay Helpers
	-----------------------------------------------------*/
	// TODO: should be consolidated with BasicView's methods

    
	function renderDayOverlay(overlayStart, overlayEnd, refreshCoordinateGrid) { // overlayEnd is exclusive

        if (refreshCoordinateGrid) {
            coordinateGrid.build();
        }

		var segments = rangeToSegments(overlayStart, overlayEnd);

		for (var i=0; i<segments.length; i++) {
			var segment = segments[i];
			dayBind(
				renderCellOverlay(
					segment.row,
					segment.leftCol,
					segment.row,
					segment.rightCol
				)
			);
        }
	}

	
    function renderCellOverlay(row0, col0, row1, col1) { // only for all-day?
        var rect = coordinateGrid.rect(row0, col0, row1, col1, slotLayer);
        return renderOverlay(rect, slotLayer);
    }


    function renderSlotOverlay(overlayStart, overlayEnd) {
        for (var i=0; i<colCnt; i++) {
            var dayStart = cellToDate(0, i);
            var dayEnd = addDays(cloneDate(dayStart), 1);
            var stretchStart = new Date(Math.max(dayStart, overlayStart));
            var stretchEnd = new Date(Math.min(dayEnd, overlayEnd));
            if (stretchStart < stretchEnd) {
                var rect = coordinateGrid.rect(0, i, 0, i, slotContainer); // only use it for horizontal coords
                var top = timePosition(dayStart, stretchStart);
                var bottom = timePosition(dayStart, stretchEnd);
                rect.top = top;
                rect.height = bottom - top;
                slotBind(
                    renderOverlay(rect, slotContainer)
                );
            }
        }
    }
	
	
    
    /* Coordinate Utilities
	-----------------------------------------------------------------------------*/
	
	
    coordinateGrid = new CoordinateGrid(function(rows, cols) {
        var e, n, p;
        resourceHeadCells.each(function(i, _e) {
            e = $(_e);
            n = e.offset().left;
            if (i) {
                p[1] = n;
            }
            p = [n];
            cols[i] = p;
        });
        p[1] = n + e.outerWidth();
        if (opt('allDaySlot')) {
            e = allDayRow;
            n = e.offset().top;
            rows[0] = [n, n+e.outerHeight()];
        }
		var slotTableTop = slotContainer.offset().top;
        var slotScrollerTop = slotScroller.offset().top;
        var slotScrollerBottom = slotScrollerTop + slotScroller.outerHeight();
        function constrain(n) {
            return Math.max(slotScrollerTop, Math.min(slotScrollerBottom, n));
        }
		for (var i=0; i<slotCnt*snapRatio; i++) { // adapt slot count to increased/decreased selection slot count
            rows.push([
				constrain(slotTableTop + snapHeight*i),
				constrain(slotTableTop + snapHeight*(i+1))
                ]);
        }
    });
	
	
    hoverListener = new HoverListener(coordinateGrid);
	
	colPositions = new HorizontalPositionCache(function(col) {
		return dayBodyCellInners.eq(col);
	});

    colContentPositions = new HorizontalPositionCache(function(col) {
		return dayBodyCellContentInners.eq(col);
    });
	
	
	function colLeft(col) {
		return colPositions.left(col);
	}


    function colContentLeft(col) {
        return colContentPositions.left(col);
    }
	
	
	function colRight(col) {
		return colPositions.right(col);
	}


    function colContentRight(col) {
        return colContentPositions.right(col);
    }
	
	
	function getIsCellAllDay(cell) {
		return opt('allDaySlot') && !cell.row;
    }
	
	
	function realCellToDate(cell) { // ugh "real" ... but blame it on our abuse of the "cell" system
		var d = cellToDate(0, cell.col);
        var slotIndex = cell.row;
        if (opt('allDaySlot')) {
            slotIndex--;
        }
        if (slotIndex >= 0) {
			addMinutes(d, minMinute + slotIndex * snapMinutes);
        }
        return d;
    }
    
    /* return the column index the resource is at.  Return -1 if resource cannot be found. */
    function resourceCol(date, resource) {
        var dayDelta = 0;

        for(var i=0;i<t.days.length;i++) {
            if (moment(t.days[i]).isSame(date, 'day')) {
                dayDelta = i;
                break;
            }
        }

        var resourceNum = -1;
        for (var i=0; i<resources.length; i++) {
            if (resource.id === resources[i].id) {
                resourceNum = i;
            }
        }
        if(resourceNum === -1) return -1;
        return (dayDelta * resources.length) + resourceNum;
    }

    function colToResource(col) {
        return resources[col % resources.length];
    }


    function resourceDate(col) {
        var delta = Math.floor(col / resources.length);
        if(delta > (t.days.length - 1)) delta = t.days.length - 1;
        var date = cloneDate(t.days[delta]);
        return date;
    }


    function cellToDate(row, col) {
        return resourceDate(col);
    }
	
	
    // get the Y coordinate of the given time on the given day (both Date objects)
    function timePosition(day, time) { // both date objects. day holds 00:00 of current day
        day = cloneDate(day, true);
        if (time < addMinutes(cloneDate(day), minMinute)) {
            return 0;
        }
        if (time >= addMinutes(cloneDate(day), maxMinute)) {
            return slotTable.height();
        }
        var slotMinutes = opt('slotMinutes'),
        minutes = time.getHours()*60 + time.getMinutes() - minMinute,
        slotI = Math.floor(minutes / slotMinutes),
        slotTop = slotTopCache[slotI];
        if (slotTop === undefined) {
			slotTop = slotTopCache[slotI] =
				slotTable.find('tr').eq(slotI).find('td div')[0].offsetTop;
				// .eq() is faster than ":eq()" selector
				// [0].offsetTop is faster than .position().top (do we really need this optimization?)
				// a better optimization would be to cache all these divs
        }
        return Math.max(0, Math.round(
            slotTop - 1 + slotHeight * ((minutes % slotMinutes) / slotMinutes)
            ));
    }
	

    function getAllDayRow(index) {
        if (index === 0 && allDayAxis) {
            return allDayAxis.find('tr');
        } else {
            return allDayRow;
        }
    }
	
	
    function defaultEventEnd(event) {
        var start = cloneDate(event.start);
        if (event.allDay) {
            return start;
        }
        return addMinutes(start, opt('defaultEventMinutes'));
    }
	
	
	
    /* Selection
	---------------------------------------------------------------------------------*/
	
	
    function defaultSelectionEnd(startDate, allDay) {
        if (allDay) {
            return cloneDate(startDate);
        }
        return addMinutes(cloneDate(startDate), opt('slotMinutes'));
    }
	
	
    function renderSelection(startDate, endDate, allDay, resource) { // only for all-day
        if (allDay) {
            if (opt('allDaySlot')) {
                renderDayOverlay(startDate, addDays(cloneDate(endDate), 1), true, resource);
            }
        }else{
            renderSlotSelection(startDate, endDate, resource);
        }
    }
	
	
    function renderSlotSelection(startDate, endDate, resource) {
        var helperOption = opt('selectHelper');
        coordinateGrid.build();
        if (helperOption) {
            var col = resourceCol(startDate, resource);
            if (col >= 0 && col < colCnt) { // only works when times are on same day
				var rect = coordinateGrid.rect(0, col, 0, col, slotContainer); // only for horizontal coords
                var top = timePosition(startDate, startDate);
                var bottom = timePosition(startDate, endDate);
                if (bottom > top) { // protect against selections that are entirely before or after visible range
                    rect.top = top;
                    rect.height = bottom - top;
                    rect.left += 2;
                    rect.width -= 5;
                    if ($.isFunction(helperOption)) {
                        var helperRes = helperOption(startDate, endDate);
                        if (helperRes) {
                            rect.position = 'absolute';
                            selectionHelper = $(helperRes)
                            .css(rect)
								.appendTo(slotContainer);
                        }
                    }else{
                        rect.isStart = true; // conside rect a "seg" now
                        rect.isEnd = true;   //
                        selectionHelper = $(slotSegHtml(
                        {
                            title: '',
                            start: startDate,
                            end: endDate,
                            className: ['fc-select-helper'],
                            editable: false
                        },
                        rect
                        ));
                        selectionHelper.css('opacity', opt('dragOpacity'));
                    }
                    if (selectionHelper) {
                        slotBind(selectionHelper);
						slotContainer.append(selectionHelper);
                        setOuterWidth(selectionHelper, rect.width, true); // needs to be after appended
                        setOuterHeight(selectionHelper, rect.height, true);
                    }
                }
            }
        }else{
            renderSlotOverlay(startDate, endDate);
        }
    }
	
	
    function clearSelection() {
        clearOverlays();
        if (selectionHelper) {
            selectionHelper.remove();
            selectionHelper = null;
        }
    }
	
	
    function slotSelectionMousedown(ev) {
        if (ev.which == 1 && opt('selectable')) { // ev.which==1 means left mouse button
            unselect(ev);
            var lastDate;
            var dates;
            var resource;
            hoverListener.start(function(cell, origCell) {
                clearSelection();
				if (cell && cell.col == origCell.col && !getIsCellAllDay(cell)) {
                    resource = resources[cell.col % resources.length];
                    var d1 = realCellToDate(origCell);
                    var d2 = lastDate = realCellToDate(cell);
                    dates = [
                    d1,
						addMinutes(cloneDate(d1), snapMinutes), // calculate minutes depending on selection slot minutes
                    d2,
						addMinutes(cloneDate(d2), snapMinutes)
					].sort(dateCompare);
                    if(!opt('hideSelection')) renderSlotSelection(dates[0], dates[3], resource);
                }else{
                    dates = null;
                }
            }, ev);
            $(document).one('mouseup', function(ev) {
                hoverListener.stop();
				if (dates) {
					if (+dates[0] == +dates[1]) {
						reportDayClick(dates[0], false, ev);
					}
                    reportSelection(dates[0], dates[3], false, ev, resource.id, lastDate);
                }
            });
        }
    }


    function daySelectionMousedown(ev) {
        if (ev.which == 1 && opt('selectable')) { // ev.which==1 means left mouse button
            unselect(ev);
            var dates;
            var resource;
            hoverListener.start(function(cell, origCell) {
                clearSelection();
                if (cell && getIsCellAllDay(cell)) {
                    resource = resources[cell.col % resources.length];
                    var d1 = realCellToDate(origCell);
                    var d2 = realCellToDate(cell);
                    dates = [
                        d1,
                        d2
                    ].sort(dateCompare);
                    if(!opt('hideSelection')) renderSelection(dates[0], dates[1], true, resource);
                }else{
                    dates = null;
                }
            }, ev);
            $(document).one('mouseup', function(ev) {
                hoverListener.stop();
                if (dates) {
                    if (+dates[0] == +dates[1]) {
                        reportDayClick(dates[0], true, ev);
                    }
                    reportSelection(dates[0], dates[1], true, ev, resource.id);
                }
            });
        }
    }
	
	
    function reportDayClick(date, allDay, ev) {
		trigger('dayClick', dayBodyCells[dateToCell(date).col], date, allDay, ev);
    }
	
	
	
    /* External Dragging
	--------------------------------------------------------------------------------*/
	
	
    function dragStart(_dragElement, ev, ui) {
        hoverListener.start(function(cell) {
            clearOverlays();
            if (cell) {
				if (getIsCellAllDay(cell)) {
                    renderCellOverlay(cell.row, cell.col, cell.row, cell.col);
                }else{
					var d1 = realCellToDate(cell);
                    var d2 = addMinutes(cloneDate(d1), opt('defaultEventMinutes'));
                    renderSlotOverlay(d1, d2);
                }
            }
        }, ev);
    }
	
	
    function dragStop(_dragElement, ev, ui) {
        var cell = hoverListener.stop();
        clearOverlays();
        if (cell) {
            debugger;
			trigger('drop', _dragElement, realCellToDate(cell), getIsCellAllDay(cell), ev, ui);
        }
    }


}
