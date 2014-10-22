
fcViews.resourceMultiDay = ResourceMultiDayView;

function ResourceMultiDayView(element, calendar) {
	var t = this;
	
	
	// exports
	t.render = render;
    t.setDays = setDays;
	
	
	// imports
	ResourceView.call(t, element, calendar, 'resourceMultiDay');
	var opt = t.opt;
	var renderResource = t.renderResource;
    var skipHiddenDays = t.skipHiddenDays;
	var formatDate = calendar.formatDate;
	

	function render(date, delta) {
        var days;
        if (delta instanceof Array) {
            days = [];
            delta.forEach(function(date) {
                days.push(cloneDate(date, true));
            });

            var start = cloneDate(days[0], true);
            var end = cloneDate(days[days.length-1], true);

            t.title = formatDate(date, opt('titleFormat'));

            t.start = t.visStart = start;
            t.end = t.visEnd = end;
        }
        else {
            if(t.days == null) {
                if(opt('days') != null) {
                    days = opt('days');

                    var start = cloneDate(days[0], true);
                    var end = cloneDate(days[days.length-1], true);

                    t.title = formatDate(start, opt('titleFormat'));

                    t.start = t.visStart = start;
                    t.end = t.visEnd = end;
                }
                else {
                    skipHiddenDays(date, delta < 0 ? -1 : 1);

                    t.title = formatDate(date, opt('titleFormat'));

                    var start = cloneDate(date, true);
                    var end = addDays(cloneDate(start), 1);

                    t.start = t.visStart = start;
                    t.end = t.visEnd = end;

                    days = [];

                    var ms = start.getTime();

                    if(delta < 1) delta = 1;
                    for(var i=0;i<delta;i++) {
                        days.push(new Date(ms + (i * 1000 * 60 * 60 * 24)));
                    }
                }
            }
            else {
                days = [];
                for(var i=0;i<t.days.length;i++) {
                    var day = t.days[i];
                    var ms = day.getTime();
                    days.push(new Date(ms + (delta * 1000 * 60 * 60 * 24)));
                }

                var start = cloneDate(days[0], true);
                var end = cloneDate(days[days.length-1], true);

                t.title = formatDate(start, opt('titleFormat'));

                t.start = t.visStart = start;
                t.end = t.visEnd = end;
            }
        }

		renderResource(days);
	}

    function setDays(days) {
        renderResource(days);
    }

}
