<?php

	$year = date('Y');
	$month = date('m');

	echo json_encode(array(
	
		array(
			'id' => 111,
			'title' => "Event1",
			'start' => "$year-$month-10",
			'url' => "http://yahoo.com/",
            'resourceId' => 1
		),
		
		array(
			'id' => 222,
			'title' => "Event2",
			'start' => "$year-$month-19T08:00:00Z",
			'end' => "$year-$month-19T12:00:00Z",
            'allDay' => false,
			'url' => "http://yahoo.com/",
            'resourceId' => 2
		)/*,

        array(
			'id' => 333,
			'title' => "Event2",
			'start' => "$year-$month-19T14:30:00Z",
			'end' => "$year-$month-19T16:00:00Z",
            'allDay' => false,
            'resourceId' => 3
		)*/
	
	));

?>
