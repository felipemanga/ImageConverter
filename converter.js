document.addEventListener("DOMContentLoaded", function(){
    document.body.addEventListener("dragenter", cancelEvent);
    document.body.addEventListener("dragover", cancelEvent);
    document.body.addEventListener("drop", dropFile);
});

function cancelEvent( event ){
    event.stopPropagation();
    event.preventDefault();
}

var lastPalette;

function dropFile( event ){
    event.stopPropagation();
    event.preventDefault();
	
    var dt = event.dataTransfer;
    var files = dt.files;
    var out = [];
    var pendingPal = 1;
    var pending = 0;

    for (var i = 0; i < files.length; i++) {
	let file = files[i];

	if( /\.pal$/i.test(file.name) ){
	    pendingPal++;
	    let fr = new FileReader();
	    fr.onload = convertPalette.bind( null, fr, file );
	    fr.readAsText( file );
	}
	
    }

    if( !--pendingPal )
	donePaletteMode();

    function donePaletteMode(){
	
	for (var i = 0; i < files.length; i++) {
	    let file = files[i];

	    if( /\.(png|jpg)$/i.test(file.name) ){
		pending++;
		let fr = new FileReader();
		fr.onload = convert.bind( null, fr, file );
		fr.readAsDataURL(file);
	    }
	    
	}

	if( !pending )
	    write();

    }


    function cleanName( name ){
	
	return name
	    .replace(/^.*?([^\/\\.]+)\..+$/,'$1')
	    .replace(/^([0-9])/, "_$1");
	
    }

    function convertPalette( fr, file ){

	var str = fr.result.split("\n");
	var acc = [], pal = [];
	lastPalette = pal;
	str.shift(); // JASC-PAL
	str.shift(); // 0100 version
	var max = parseInt(str.shift()); // color count
	for( var i=0; i<max && str.length; ++i ){
	    var line = str.shift().split(/\s/).map( x => parseInt(x) );
	    pal.push( line );
	    acc.push(
		'0x' + (
		    ((line[0]/0xFF*0x1F|0)<<11)
			+ ((line[1]/0xFF*0x3F|0)<<5)
			+ ((line[2]/0xFF*0x1F|0))
		).toString(16).padStart(2, '0')
	    );
	    
	}

	var name = cleanName(file.name);

	out.push({
	    name,
	    cpp:`const unsigned short ${name}[] = {${acc.join(',')}};\n`
	});
	pendingPal--;

	if( !pendingPal )
	    donePaletteMode();
    }

    function convert( fr, file ){

	var img = document.createElement("img");
	img.onload = onLoad;
	img.src = fr.result;

	function onLoad(){

	    var clean = cleanName(file.name);
	    
	    var ab = loadImage( img, clean, /.*\.png$/i.test(file.name) );

	    ab.name = clean;

	    if( lastPalette )
		convert8Bit( ab );

	    convert32Bit( ab );
	    
	    out.push( ab );
	    pending--;
	    if( !pending )
		write();
	}
	
    }

    function convert32Bit( ab ){
	var data = ab.data.data;
	var W = ab.data.width;
	var acc = [W, ab.data.height];

	for( var y=0; y<ab.data.height; ++y ){
	    for( var x=0; x<W; ++x ){
		var i = (y*W+x)*4;
		acc.push( data[i++],data[i++],data[i++] );
	    }
	}

	ab.cpp = '\n\n// ------------ 24 bits per pixel -----------------' +
	    `\nconst unsigned char ${name}_24bit = {\n//width, height\n${acc.join(',')}\n};\n\n` + ab.cpp;
	
	
	var url = URL.createObjectURL(
	    new Blob([data], {type:'application/bin'})
	);
	
	var a = document.createElement('A');
	
	a.href = url;
	a.textContent = "RGBA";
	a.setAttribute("download", ab.name + ".RGB");
	a.style = `
position: absolute; 
top:0; right:0;
border: solid 1px #123;
background: #345;
color: #ABC;
`;
	document.body.appendChild( a );
    }

    function convert8Bit( ab ){
	var name = ab.name;
	var strips = [], acc = [], racc = [];
	var pal = lastPalette;
	var data = ab.data.data;

	var W=ab.data.width;
	var H=ab.data.height;

	for( var x=0; x<W; ++x ){

	    var firstOpaque = -1;
	    var lastOpaque = -1;
	    var start = acc.length;
	    
	    for( var y=0; y<H; ++y ){
		var i = (y*W + x) * 4;
		var closestC = 0;
		var closestDist = Number.POSITIVE_INFINITY;
		var secondC = 0;
		var secondDist = Number.POSITIVE_INFINITY;

		var R = data[i++];
		var G = data[i++];
		var B = data[i++];
		var A = data[i++];
		var c=0;
		
		if( A > 128 ){
		    
		    if( firstOpaque == -1 )
			firstOpaque = y;
		    
		    lastOpaque = y;
		    
		    for( ; c<pal.length; ++c ){
			var ca = pal[c];

			var dist = (R-ca[0])*(R-ca[0]) + (G-ca[1])*(G-ca[1]) + (B-ca[2])*(B-ca[2]);
			if( dist < closestDist ){
			    secondDist = dist;
			    secondC = c;
			    closestDist = dist;
			    closestC = c;
			}else if( dist < secondDist ){
			    secondDist = dist;
			    secondC = c;
			}
			
		    }
		    
		}

		var strc = `0x` +
		    closestC.toString(16).padStart(2, '0');
		
		if( firstOpaque != -1 )
		    acc.push( (firstOpaque == y ? '\n' : '') + strc);
		
		racc.push((!y?'\n':'') + strc);
	    }

	    if( firstOpaque != -1 ){
		acc.splice( acc.length - (H - lastOpaque - 1), H - lastOpaque - 1 );
		strips.push( firstOpaque, lastOpaque + 1 - firstOpaque );
	    }else{
		strips.push( 0, 0 );
	    }
	    
	}

	strips[0] = "\n" + strips[0];

	acc = [ W, H, ...strips, ...acc ];

	ab.cpp = '\n\n// ------------ POKITTO-compatible 8bits per pixel -----------------' +
	    `\nconst unsigned char ${name}_sprite8[] = {\n//width, height\n${acc.join(',')}\n};\n\n` +
	    `\nconst unsigned char ${name}_tile8[] = {\n${racc.join(',')}\n};\n\n` +
	    ab.cpp;
	
    }

    function write(){
	var acc = [];
	for( var i=0; i<out.length; ++i ){
	    
	    acc.push(
		`\n\n// ------------ ${out[i].name} -----------------\n` +
		(out[i].ascii||'') +
		    out[i].cpp
	    );
	    
	}
	code.textContent = acc.join("\n\n");
    }
    
    
}
