/**
 * "The Integration Layer" — the 3D scene behind the portfolio.
 *
 * An AI core (a breathing cloud of points inside a wireframe shell) sits at the centre. Around it
 * orbit the systems Pranjal has led for a decade — .NET, Azure, AWS, React, Kubernetes… — each
 * wired to the core. Pulses run along the wires both ways: requests in (cyan), model answers out
 * (amber). That is the job: integrating AI into what already runs. Scroll moves the camera
 * between one shot per section ([data-shot]). The canvas is aria-hidden; all copy is HTML.
 */
// Relative, NOT a bare 'three' specifier — see functions.php.
import * as THREE from './three/three.module.min.js';

const C = { cyan: 0x22d3ee, violet: 0x8b5cf6, amber: 0xf59e0b, pink: 0xec4899 };
const lerp = ( a, b, t ) => a + ( b - a ) * t;
const ease = t => t * t * ( 3 - 2 * t );

// Camera shots, keyed by section. p = camera position, t = look-at, core = core scale,
// speed = pulse speed, labels = label opacity, spin = network rotation speed.
const SHOTS = { // desktop: the core sits right of the copy; portrait screens re-centre it (see target())
	top:     { p: [ -4.2, 0.6, 12.5 ], t: [ -4.2, 0.2, 0 ], core: 1.0, speed: 1.0, labels: 0.85, spin: 0.05 },
	ai:      { p: [ -2.6, 1.2, 6.5 ],  t: [ -3.2, 0.2, 0 ], core: 1.35, speed: 2.6, labels: 0.35, spin: 0.09 },
	about:   { p: [ -3.8, 4.5, 8 ],    t: [ -3.8, 0.4, 0 ], core: 1.0, speed: 1.0, labels: 0.6, spin: 0.05 },
	work:    { p: [ -4, 13, 9 ],       t: [ -4, 0, 0 ],     core: 0.9, speed: 1.4, labels: 0.5, spin: 0.04 },
	stack:   { p: [ -6.5, 0.8, 4.2 ],  t: [ 2, -0.3, 0 ],   core: 0.8, speed: 1.2, labels: 1.0, spin: 0.03 },
	contact: { p: [ -6, 1.5, 18 ],     t: [ -6, 0, 0 ],     core: 1.1, speed: 0.7, labels: 0.45, spin: 0.06 },
};

function glowTexture( stops ) {
	const c = document.createElement( 'canvas' );
	c.width = c.height = 128;
	const g = c.getContext( '2d' );
	const r = g.createRadialGradient( 64, 64, 0, 64, 64, 64 );
	stops.forEach( ( [ o, col ] ) => r.addColorStop( o, col ) );
	g.fillStyle = r;
	g.fillRect( 0, 0, 128, 128 );
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

function labelSprite( text ) {
	const c = document.createElement( 'canvas' );
	const g = c.getContext( '2d' );
	const font = '600 44px "JetBrains Mono", ui-monospace, monospace';
	g.font = font;
	const w = Math.ceil( g.measureText( text ).width ) + 48;
	c.width = w; c.height = 76;
	g.font = font;
	g.fillStyle = 'rgba(8,10,24,.72)';
	g.strokeStyle = 'rgba(34,211,238,.55)';
	g.lineWidth = 3;
	g.beginPath(); g.roundRect( 2, 2, w - 4, 72, 36 ); g.fill(); g.stroke();
	g.fillStyle = '#e6f6ff';
	g.textBaseline = 'middle';
	g.fillText( text, 24, 40 );
	const tex = new THREE.CanvasTexture( c );
	tex.colorSpace = THREE.SRGBColorSpace;
	const s = new THREE.Sprite( new THREE.SpriteMaterial( { map: tex, transparent: true, depthWrite: false, sizeAttenuation: false } ) );
	s.scale.set( 0.021 * w / 76, 0.021, 1 ); // fixed ~20px tall on screen, near or far
	return s;
}

/** Evenly spread n points on a sphere (Fibonacci lattice). */
function fibonacci( n, r ) {
	const out = [];
	const ga = Math.PI * ( 3 - Math.sqrt( 5 ) );
	for ( let i = 0; i < n; i++ ) {
		const y = 1 - ( i / ( n - 1 ) ) * 2, rad = Math.sqrt( 1 - y * y ), th = ga * i;
		out.push( new THREE.Vector3( Math.cos( th ) * rad * r, y * r, Math.sin( th ) * rad * r ) );
	}
	return out;
}

export function boot( cfg ) {
	const mobile = cfg.mobile;
	const canvas = document.createElement( 'canvas' );
	canvas.className = 'pm-canvas';
	canvas.setAttribute( 'aria-hidden', 'true' );
	document.body.prepend( canvas );

	const renderer = new THREE.WebGLRenderer( { canvas, antialias: ! mobile, alpha: true, powerPreference: 'high-performance' } );
	renderer.setPixelRatio( Math.min( devicePixelRatio, mobile ? 1.5 : 2 ) );
	renderer.setClearColor( 0x000000, 0 );

	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2( 0x05060f, 0.028 );
	const camera = new THREE.PerspectiveCamera( 45, 1, 0.1, 200 );

	const soft = glowTexture( [ [ 0, 'rgba(255,255,255,1)' ], [ 0.25, 'rgba(255,255,255,.55)' ], [ 1, 'rgba(255,255,255,0)' ] ] );

	/* ── The core ─────────────────────────────────────────────────────────── */
	const core = new THREE.Group();
	scene.add( core );

	const halo = new THREE.Sprite( new THREE.SpriteMaterial( {
		map: glowTexture( [ [ 0, 'rgba(167,139,250,.9)' ], [ 0.35, 'rgba(99,102,241,.35)' ], [ 0.7, 'rgba(34,211,238,.08)' ], [ 1, 'rgba(0,0,0,0)' ] ] ),
		blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
	} ) );
	halo.scale.setScalar( 8 );
	core.add( halo );

	const shell = new THREE.Mesh(
		new THREE.IcosahedronGeometry( 1.75, 1 ),
		new THREE.MeshBasicMaterial( { color: C.violet, wireframe: true, transparent: true, opacity: 0.32 } )
	);
	core.add( shell );

	const CORE_N = mobile ? 700 : 1400;
	const coreBase = fibonacci( CORE_N, 1.25 );
	const corePos = new Float32Array( CORE_N * 3 );
	const coreGeo = new THREE.BufferGeometry();
	coreGeo.setAttribute( 'position', new THREE.BufferAttribute( corePos, 3 ) );
	const corePts = new THREE.Points( coreGeo, new THREE.PointsMaterial( {
		size: 0.07, map: soft, color: 0xc4b5fd, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	} ) );
	core.add( corePts );

	// Two orbital rings — the "integration" bands.
	const rings = [ [ 2.4, 1.1, 0.3, C.cyan ], [ 2.9, -0.5, 1.2, C.pink ] ].map( ( [ r, rx, rz, col ] ) => {
		const m = new THREE.Mesh(
			new THREE.TorusGeometry( r, 0.008, 6, 160 ),
			new THREE.MeshBasicMaterial( { color: col, transparent: true, opacity: 0.55 } )
		);
		m.rotation.set( rx, 0, rz );
		core.add( m );
		return m;
	} );

	/* ── The network of systems ───────────────────────────────────────────── */
	const net = new THREE.Group();
	scene.add( net );
	const names = cfg.nodes;
	const nodes = fibonacci( names.length, 5.6 ).map( ( v, i ) => v.multiplyScalar( 1 + ( ( i * 37 ) % 7 ) / 30 ) );

	const nodeMat = new THREE.SpriteMaterial( { map: soft, color: C.cyan, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true } );
	const labels = [];
	nodes.forEach( ( v, i ) => {
		const dot = new THREE.Sprite( nodeMat );
		dot.position.copy( v );
		dot.scale.setScalar( 0.55 );
		net.add( dot );
		const l = labelSprite( names[ i ] );
		l.position.copy( v ).add( new THREE.Vector3( 0, 0.48, 0 ) );
		net.add( l );
		labels.push( l );
	} );

	// Wires: every node to the core, plus each node to its two nearest neighbours.
	const wire = [];
	nodes.forEach( v => { const e = v.clone().setLength( 1.75 ); wire.push( v.x, v.y, v.z, e.x, e.y, e.z ); } );
	nodes.forEach( ( v, i ) => {
		nodes.map( ( w, j ) => [ j, v.distanceTo( w ) ] ).filter( ( [ j ] ) => j > i )
			.sort( ( a, b ) => a[ 1 ] - b[ 1 ] ).slice( 0, 2 )
			.forEach( ( [ j ] ) => wire.push( v.x, v.y, v.z, nodes[ j ].x, nodes[ j ].y, nodes[ j ].z ) );
	} );
	const wireGeo = new THREE.BufferGeometry();
	wireGeo.setAttribute( 'position', new THREE.Float32BufferAttribute( wire, 3 ) );
	net.add( new THREE.LineSegments( wireGeo, new THREE.LineBasicMaterial( { color: 0x3b82f6, transparent: true, opacity: 0.28 } ) ) );

	// Pulses travelling node ⇄ core.
	const PULSES = mobile ? 28 : 56;
	const pulse = Array.from( { length: PULSES }, ( _, i ) => ( { n: i % nodes.length, t: Math.random(), out: i % 2 === 1, v: 0.25 + Math.random() * 0.35 } ) );
	const pPos = new Float32Array( PULSES * 3 ), pCol = new Float32Array( PULSES * 3 );
	const cIn = new THREE.Color( C.cyan ), cOut = new THREE.Color( C.amber );
	pulse.forEach( ( p, i ) => ( p.out ? cOut : cIn ).toArray( pCol, i * 3 ) );
	const pGeo = new THREE.BufferGeometry();
	pGeo.setAttribute( 'position', new THREE.BufferAttribute( pPos, 3 ) );
	pGeo.setAttribute( 'color', new THREE.BufferAttribute( pCol, 3 ) );
	net.add( new THREE.Points( pGeo, new THREE.PointsMaterial( {
		size: 0.32, map: soft, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	} ) ) );

	/* ── Dust ─────────────────────────────────────────────────────────────── */
	const DUST = mobile ? 600 : 1400;
	const dPos = new Float32Array( DUST * 3 );
	for ( let i = 0; i < DUST; i++ ) {
		const v = new THREE.Vector3().randomDirection().multiplyScalar( 9 + Math.random() * 40 );
		v.toArray( dPos, i * 3 );
	}
	const dGeo = new THREE.BufferGeometry();
	dGeo.setAttribute( 'position', new THREE.BufferAttribute( dPos, 3 ) );
	const dust = new THREE.Points( dGeo, new THREE.PointsMaterial( { size: 0.09, map: soft, color: 0x93c5fd, transparent: true, opacity: 0.7, depthWrite: false } ) );
	scene.add( dust );

	/* ── Shots, scroll, pointer ───────────────────────────────────────────── */
	const sections = [ ...document.querySelectorAll( '[data-shot]' ) ].filter( s => SHOTS[ s.dataset.shot ] );
	const cur = { p: new THREE.Vector3( ...SHOTS.top.p ), t: new THREE.Vector3( ...SHOTS.top.t ), core: 1, speed: 1, labels: 0.8, spin: 0.05 };
	const want = { p: new THREE.Vector3(), t: new THREE.Vector3() };
	const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
	addEventListener( 'pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true } );

	function target() {
		// Section i is "on" when its top reaches 35% of the viewport; blend toward i+1 across the gap.
		const y = scrollY + innerHeight * 0.35;
		const tops = sections.map( s => s.getBoundingClientRect().top + scrollY );
		let i = 0;
		while ( i < tops.length - 1 && y >= tops[ i + 1 ] ) i++;
		const a = SHOTS[ sections[ i ].dataset.shot ], b = SHOTS[ ( sections[ i + 1 ] || sections[ i ] ).dataset.shot ];
		const span = tops[ i + 1 ] - tops[ i ]; // NaN on the last section → f = 0 below
		const f = i === tops.length - 1 ? 0 : ease( Math.min( 1, Math.max( 0, ( y - tops[ i ] - span * 0.45 ) / ( span * 0.55 ) ) ) );
		const portrait = innerWidth / innerHeight < 0.9;
		want.p.set( lerp( a.p[ 0 ], b.p[ 0 ], f ), lerp( a.p[ 1 ], b.p[ 1 ], f ), lerp( a.p[ 2 ], b.p[ 2 ], f ) );
		want.t.set( lerp( a.t[ 0 ], b.t[ 0 ], f ), lerp( a.t[ 1 ], b.t[ 1 ], f ), lerp( a.t[ 2 ], b.t[ 2 ], f ) );
		if ( portrait ) { // narrow screens: centre the core, pull back, sit it low behind the copy
			want.p.x -= want.t.x; want.t.x = 0;
			want.p.multiplyScalar( 1.45 ); want.t.y += 3;
		}
		return {
			core: lerp( a.core, b.core, f ), speed: lerp( a.speed, b.speed, f ),
			labels: lerp( a.labels, b.labels, f ), spin: lerp( a.spin, b.spin, f ),
		};
	}

	function resize() {
		const w = innerWidth, h = innerHeight;
		renderer.setSize( w, h, false );
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}
	addEventListener( 'resize', resize );
	resize();

	canvas.addEventListener( 'webglcontextlost', e => {
		e.preventDefault();
		document.documentElement.classList.remove( 'pm-3d' );
		canvas.remove();
	} );

	const clock = new THREE.Clock();
	const tmp = new THREE.Vector3();
	let spinA = 0;
	function frame() {
		const dt = Math.min( clock.getDelta(), 0.05 ), t = clock.elapsedTime;
		const k = 1 - Math.pow( 0.002, dt ); // frame-rate independent smoothing
		const s = target();
		cur.p.lerp( want.p, k ); cur.t.lerp( want.t, k );
		for ( const key of [ 'core', 'speed', 'labels', 'spin' ] ) cur[ key ] = lerp( cur[ key ], s[ key ], k );
		mouse.sx = lerp( mouse.sx, mouse.x, k ); mouse.sy = lerp( mouse.sy, mouse.y, k );

		camera.position.copy( cur.p ).add( tmp.set( mouse.sx * 1.6, -mouse.sy * 1.0, 0 ) );
		camera.lookAt( cur.t );

		// Core breathes; its points ripple like activations.
		const breath = cur.core * ( 1 + Math.sin( t * 1.3 ) * 0.03 );
		core.scale.setScalar( breath );
		for ( let i = 0; i < CORE_N; i++ ) {
			const b = coreBase[ i ];
			const d = 1 + 0.12 * Math.sin( b.x * 3 + t * 1.7 ) * Math.sin( b.y * 3.4 + t * 1.1 ) * Math.sin( b.z * 2.8 + t * 1.4 );
			corePos[ i * 3 ] = b.x * d; corePos[ i * 3 + 1 ] = b.y * d; corePos[ i * 3 + 2 ] = b.z * d;
		}
		coreGeo.attributes.position.needsUpdate = true;
		shell.rotation.y = t * 0.15; shell.rotation.x = t * 0.07;
		rings[ 0 ].rotation.y = t * 0.4; rings[ 1 ].rotation.y = -t * 0.3;
		halo.material.opacity = 0.75 + Math.sin( t * 2 ) * 0.15;

		spinA += dt * cur.spin;
		net.rotation.y = spinA; net.rotation.x = Math.sin( t * 0.1 ) * 0.12;
		labels.forEach( l => { l.material.opacity = cur.labels * ( mobile ? 0.6 : 1 ); } );

		pulse.forEach( ( p, i ) => {
			p.t += dt * p.v * cur.speed;
			if ( p.t > 1 ) { p.t -= 1; p.n = ( p.n + 5 ) % nodes.length; }
			const a = nodes[ p.n ], u = p.out ? 1 - p.t : p.t; // u: 0 at node, 1 at core shell
			tmp.copy( a ).multiplyScalar( 1 - u + u * ( 1.75 / a.length() ) );
			tmp.toArray( pPos, i * 3 );
		} );
		pGeo.attributes.position.needsUpdate = true;

		dust.rotation.y = t * 0.01;
		renderer.render( scene, camera );
		requestAnimationFrame( frame );
	}
	requestAnimationFrame( frame );
	document.documentElement.classList.add( 'pm-ready' );
}
