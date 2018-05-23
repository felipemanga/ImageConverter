document.addEventListener("DOMContentLoaded", function(){
    document.body.addEventListener("dragenter", cancelEvent);
    document.body.addEventListener("dragover", cancelEvent);
    document.body.addEventListener("drop", dropFile);
});

function cancelEvent( event ){
    event.stopPropagation();
    event.preventDefault();
}

function dropFile( event ){
    event.stopPropagation();
    event.preventDefault();
	
    var dt = event.dataTransfer;
    var files = dt.files;
    var out = [];
    var pending = files.length;

    for (var i = 0; i < files.length; i++) {
	let file = files[i];
	
	let fr = new FileReader();
	fr.onload = convert.bind( null, fr, file );
	fr.readAsDataURL(file);
	
    }


    function cleanName( name ){
	
	return name
	    .replace(/^.*?([^\/\\.]+)\..+$/,'$1')
	    .replace(/^([0-9])/, "_$1");
	
    }

    function convert( fr, file ){

	var img = document.createElement("img");
	img.onload = onLoad;
	img.src = fr.result;

	function onLoad(){
	    
	    out.push(src, loadImage( img, cleanName(file.name), /.*\.png$/i.test(file.name) ));
	    pending--;
	    if( !--pending ){
		createPalette();
	    }
	}
	
    }

    function createPalette(){
	var colorgram = [[],[],[]];
	for( var i=0; i<3; ++i ){
	    colorgram[i].length = 256;
	    colorgram[i].fill(0);
	}
	
	out.forEach( data => {
	    var image = data.data.data;
	    for( var i=0; i<image.length; i++ ){
		colorgram[ image[i++] ]++;
		colorgram[ image[i++] ]++;
		colorgram[ image[i++] ]++;
	    }
	});
	    
    }

    function write(){
	
    }
    
    
}
