'using strict';

////////////////////////////////////////////////////////////////////////////////


var stats;	
var gui;

var settings = {
    initial_s: 100,
    initial_i: 5,
    initial_r: 1,
    diffusion_rate: 0.8,
    transmission_rate: 0.6,
    recovery_rate: 0.01,

	target_fps: 60,
    steps_per_frame: 1,
};

var sceneSettings = {
	ambientColor: new Float32Array([0.15, 0.15, 0.15, 1.0]),
};

////////////////////////////////////////////////////////////////////////////////

var app;

var gpuTimePanel;
var picoTimer;

var defaultShader;
var shadowMapShader;
var lightMapShader;
var texturedByLightmapShader;
var dynamicShader;
var shadowMapDynamicShader;

var blitTextureDrawCall;
var environmentDrawCall;

var sceneUniforms;

var shadowMapSize = 4096;
var shadowMapFramebuffer;

var lightMapSize = 1024;
var lightMapFramebuffer;

var giLightMapSize = 1024;

var probeRadianceFramebuffer;
var probeRadianceDrawCall;

var camera;
var directionalLight;
var meshes = [];
var staticMeshes = [];
var dynamicMeshes = [];

var probeDrawCall;
var hideProbes = false;
var probeVisualizeSHDrawCall;
var probeVisualizeRawDrawCall;
var probeLocations;
var probeVisualizeMode = 'raw';
var probeVisualizeUnlit = true;

var bakedDirect;

var num_probes;
var num_relight_rays;
var num_sh_coefficients;
var relight_uvs;
var relight_uvs_texture;
var relight_shs;
var relight_shs_texture;
var relight_dirs;
var relight_dirs_texture;
var probe_pos_texture;
var dict;

var u_texture;
var full_texture;

var px_map;
var probe_indices;
var dictionary_coeffs;

var calcGIShader;
var applyDictDrawCall;
var GIDrawCall;






var SIRFramebuffer;
var SIRTexture;

var movementFramebuffer;
// var SMoveTexture, IMoveTexture, RMoveTexture; // (RGBA32F)
// var SIRStayTexture; // (RGB32F)

var lattice_width = 100;
var lattice_height = 100;

var num_rands_per_pixel = 10;
var num_precomputed_noise_textures = 2;

var noiseTextures = Array(num_precomputed_noise_textures);
var noise_texture_index = 0;

var noiseTextureWidth = lattice_width * lattice_height;
var noiseTextureHeight = num_rands_per_pixel;

var applySIRMovementDrawCall;
var calcMovementDrawCall;








window.addEventListener('DOMContentLoaded', function () {

	init();
	resize();

	window.addEventListener('resize', resize, false);
	requestAnimationFrame(render);

}, false);

////////////////////////////////////////////////////////////////////////////////
// Utility

function checkWebGL2Compability() {

	var c = document.createElement('canvas');
	var webgl2 = c.getContext('webgl2');
	if (!webgl2) {
		var message = document.createElement('p');
		message.id = 'no-webgl2-error';
		message.innerHTML = 'WebGL 2.0 doesn\'t seem to be supported in this browser and is required for this demo! ' +
			'It should work on most modern desktop browsers though.';
		canvas.parentNode.replaceChild(message, document.getElementById('canvas'));
		return false;
	}
	return true;

}

function loadTexture(imageName, options) {

	if (!options) {

		var options = {};
		options['minFilter'] = PicoGL.LINEAR_MIPMAP_NEAREST;
		options['magFilter'] = PicoGL.LINEAR;
		options['mipmaps'] = true;

	}

	var texture = app.createTexture2D(1, 1, options);
	texture.data(new Uint8Array([200, 200, 200, 256]));

	var image = document.createElement('img');
	image.onload = function() {

		texture.resize(image.width, image.height);
		texture.data(image);

	};
	image.src = 'assets/' + imageName;
	return texture;

}


function makeSingleColorTexture(color) {
    var options = {};
    options['minFilter'] = PicoGL.NEAREST;
    options['magFilter'] = PicoGL.NEAREST;
    options['mipmaps'] = false;
    options['format'] = PicoGL.RGB;
    options['internalFormat'] = PicoGL.RGB32F;
    options['type'] = PicoGL.FLOAT;
    var side = 32;
    var arr =  [];
    for (var i = 0; i < side*side; i++) {
    	arr = arr.concat(color);
	}
    var image_data = new Float32Array( arr );
    return app.createTexture2D(image_data, side, side, options);
}


// num_relight_rays_per_probe * num_probes (RG32F where R,G = u,v coordinates)
// ex. 100 * 72
function makeTextureFromRelightUVs(relight_uvs) {
    var options = {};
    options['minFilter'] = PicoGL.NEAREST;
    options['magFilter'] = PicoGL.NEAREST;
    options['mipmaps'] = false;
    options['format'] = PicoGL.RG;
    options['internalFormat'] = PicoGL.RG32F;
    options['type'] = PicoGL.FLOAT;
    image_data = new Float32Array(relight_uvs.reduce( (a,b) => a.concat(b)).map( x => x==-1?-1:x/giLightMapSize));
    return app.createTexture2D(image_data, num_relight_rays, num_probes, options);
}

// num_sh_coefficients * num_relight_rays
// ex. 16 * 100
function makeTextureFromRelightSHs(relight_shs) {
    var options = {};
    options['minFilter'] = PicoGL.NEAREST;
    options['magFilter'] = PicoGL.NEAREST;
    options['mipmaps'] = false;
    options['format'] = PicoGL.RED;
    options['internalFormat'] = PicoGL.R32F;
    options['type'] = PicoGL.FLOAT;
    var image_data = new Float32Array(relight_shs.reduce( (a,b) => a.concat(b)));
    return app.createTexture2D(image_data, num_sh_coefficients, num_relight_rays, options);
}

// For debugging purposes
// num_relight_rays_per_probe * 1 (RGB32F where R,G,B = x,y,z coordinates of unit length direction vector)
// ex. 100 * 1
function makeTextureFromRelightDirs(relight_dirs) {
    var options = {};
    options['minFilter'] = PicoGL.NEAREST;
    options['magFilter'] = PicoGL.NEAREST;
    options['mipmaps'] = false;
    options['format'] = PicoGL.RGB;
    options['internalFormat'] = PicoGL.RGB32F;
    options['type'] = PicoGL.FLOAT;
    image_data = new Float32Array(relight_dirs.reduce( (a,b) => a.concat(b)));
    return app.createTexture2D(image_data, num_relight_rays, 1, options);
}

// num_probes * 1 (RGB32F where R,G,B = x,y,z coordinates of probe position)
// ex. 72 * 1
function makeTextureFromProbePositions(probe_positions) {
    var options = {};
    options['minFilter'] = PicoGL.NEAREST;
    options['magFilter'] = PicoGL.NEAREST;
    options['mipmaps'] = false;
    options['format'] = PicoGL.RGB;
    options['internalFormat'] = PicoGL.RGB32F;
    options['type'] = PicoGL.FLOAT;
    image_data = new Float32Array(probe_positions);
    console.log("num_probes: " + num_probes)
    return app.createTexture2D(image_data, num_probes, 1, options);
}

function makeTextureFromMatrix1(matrix) {
	var options = {};
	options['minFilter'] = PicoGL.NEAREST;
	options['magFilter'] = PicoGL.NEAREST;
	options['mipmaps'] = false;
	options['format'] = PicoGL.RED;
	options['internalFormat'] = PicoGL.R32F;
	options['type'] = PicoGL.FLOAT;
	return app.createTexture2D(matrix.col_major_data, matrix.rows, matrix.cols, options);
}

function makeTexturefromFloatArr(data) {
	var options = {};
	options['minFilter'] = PicoGL.NEAREST;
	options['magFilter'] = PicoGL.NEAREST;
	options['mipmaps'] = false;
	options['format'] = PicoGL.RGBA;
	options['internalFormat'] = PicoGL.RGBA16F;
	options['type'] = PicoGL.FLOAT;

	// @ROBUSTNESS, spec requires support of only 1024x1024 but if the exist on my laptop maybe it's fine?
	
	var max_size = 1<<14;

	var aligned_length = (data.length/4 + max_size-1) & ~(max_size-1);
	image_data = new Float32Array(aligned_length*4);
	image_data.set(data);
	return app.createTexture2D(image_data, max_size, aligned_length >> 14,  options);
}

function makeShader(name, shaderLoaderData) {

	var programData = shaderLoaderData[name];
	var program = app.createProgram(programData.vertexSource, programData.fragmentSource);
	return program;

}

function debugMoveDynamicObject() {
	var keys = camera.keys;
    var translation = vec3.fromValues(
        Math.sign(keys['right']  - keys['left']),
        0.0,
        Math.sign(keys['down'] - keys['up'])
    );
    // translation = vec3.fromValues(translation[0] - translation[2], 0.0, translation[0] + translation[2]);
    translation = vec3.fromValues(translation[0] * 0.05, 0.0, translation[2] * 0.05);
    if (dynamicMeshes.length > 0 && dynamicMeshes[0] !== undefined) {
    	mat4.translate(dynamicMeshes[0].modelMatrix, dynamicMeshes[0].modelMatrix, translation);
    }
}



function loadObjectUV2(directory, objFilename, mtlFilename, modelMatrix) {

	var objLoader = new OBJLoader();
	var mtlLoader = new MTLLoader();

	var path = 'assets/' + directory;

	objLoader.load(path + objFilename, function(objects) {
		console.log(objects);
		mtlLoader.load(path + mtlFilename, function(materials) {
			objects.forEach(function(object) {

				var material = materials[object.material];
				// var diffuseMap  = (material.properties.map_Kd)   ? directory + material.properties.map_Kd   : 'default_diffuse.png';
                var diffuseTexture;
                if (material.properties.map_Kd) {
                    diffuseTexture = loadTexture(directory + material.properties.map_Kd);
                } else {
                    diffuseTexture = makeSingleColorTexture(material.properties.Kd);
                }
                var specularMap = (material.properties.map_Ks)   ? directory + material.properties.map_Ks   : 'default_specular.jpg';
				var normalMap   = (material.properties.map_norm) ? directory + material.properties.map_norm : 'default_normal.jpg';

				var vertexArray = createVertexArrayFromMeshInfoUV2(object);

				var drawCall, lightMappingDrawCall;
                if (bakedDirect) {
                    drawCall = app.createDrawCall(defaultShader, vertexArray)
                        .uniformBlock('SceneUniforms', sceneUniforms)
                        .texture('u_diffuse_map', diffuseTexture);

                    lightMappingDrawCall = app.createDrawCall(lightMapShader, vertexArray)
                        .uniformBlock('SceneUniforms', sceneUniforms)
                        .texture('u_diffuse_map', diffuseTexture);
                } else {
                    drawCall = app.createDrawCall(defaultShader, vertexArray)
                        .uniformBlock('SceneUniforms', sceneUniforms)
                        .texture('u_diffuse_map', diffuseTexture)
                        .texture('u_specular_map', loadTexture(specularMap))
                        .texture('u_normal_map', loadTexture(normalMap));

                    lightMappingDrawCall = app.createDrawCall(lightMapShader, vertexArray)
                        .uniformBlock('SceneUniforms', sceneUniforms)
                        .texture('u_diffuse_map', diffuseTexture)
                        .texture('u_specular_map', loadTexture(specularMap))
                        .texture('u_normal_map', loadTexture(normalMap));
                }

				
				var shadowMappingDrawCall = app.createDrawCall(shadowMapShader, vertexArray);

				var texturedByLightmapDrawCall = app.createDrawCall(texturedByLightmapShader, vertexArray)
                    .uniformBlock('SceneUniforms', sceneUniforms)
                    .texture('u_diffuse_map', diffuseTexture)
                    .texture('u_specular_map', loadTexture(specularMap))
                    .texture('u_normal_map', loadTexture(normalMap));
				
				meshes.push({
					modelMatrix: modelMatrix || mat4.create(),
					drawCall: drawCall,
					shadowMapDrawCall: shadowMappingDrawCall,
					lightmapDrawCall: lightMappingDrawCall,
                    texturedByLightmapDrawCall: texturedByLightmapDrawCall,
                    isDynamic: false
				});

                staticMeshes.push(meshes[meshes.length-1]);

			});
		});
	});

}

////////////////////////////////////////////////////////////////////////////////
// Initialization etc.

// function setupProbeRadianceFramebuffer() {

//     var colorBuffer = app.createTexture2D(num_sh_coefficients, num_probes, {
//         internalFormat: PicoGL.RGBA16F,
//         minFilter: PicoGL.NEAREST,
//         magFilter: PicoGL.NEAREST,
//     });
//     var depthBuffer = app.createTexture2D(num_sh_coefficients, num_probes, {
//         format: PicoGL.DEPTH_COMPONENT
//     });
//     probeRadianceFramebuffer = app.createFramebuffer()
//         .colorTarget(0, colorBuffer)
//         .depthTarget(depthBuffer);
// }

function init() {

	if (!checkWebGL2Compability()) {
		return;
	}

	var canvas = document.getElementById('canvas');
    canvas.width = lattice_width;
    canvas.height = lattice_height;
	app = PicoGL.createApp(canvas, { antialias: true });
	app.floatRenderTargets();

	stats = new Stats();
    stats.showPanel(0); // (fps)
	// stats.showPanel(1); // (frame time)
	document.body.appendChild(stats.dom);

	gpuTimePanel = stats.addPanel(new Stats.Panel('MS (GPU)', '#ff8', '#221'));
	picoTimer = app.createTimer();

	gui = new dat.GUI();
    gui.add(settings, 'initial_s', 0, 10000);
    gui.add(settings, 'initial_i', 0, 10000);
    gui.add(settings, 'initial_r', 0, 10000);
    gui.add(settings, 'diffusion_rate', 0.0, 1.0);
    gui.add(settings, 'transmission_rate', 0.0, 1.0);
    gui.add(settings, 'recovery_rate', 0.0, 1.0);
    gui.add(settings, 'target_fps', 0, 120);
    gui.add(settings, 'steps_per_frame', 1, 20);

	//////////////////////////////////////
	// Basic GL state

	app.clearColor(0, 0, 0, 1);
	app.cullBackfaces();
	app.noBlend();

	//////////////////////////////////////
	// Camera stuff

	var cameraPos, cameraRot;

	// camera = new Camera(scene.cameraPos, scene.cameraRot);
    camera = new Camera(0, 0);

	//////////////////////////////////////
	// Scene setup

	setupSceneUniforms();

	var shaderLoader = new ShaderLoader('src/shaders/');
	shaderLoader.addShaderFile('common.glsl');
	shaderLoader.addShaderFile('scene_uniforms.glsl');
    shaderLoader.addShaderFile('mesh_attributes.glsl');
    // shaderLoader.addShaderProgram('padShader', 'screen_space.vert.glsl', 'padd.frag.glsl');

    shaderLoader.addShaderProgram('textureBlit', 'screen_space.vert.glsl', 'texture_blit.frag.glsl');

    shaderLoader.addShaderProgram('applySIRMovement', 'apply_movement.vert.glsl', 'apply_movement.frag.glsl');
    shaderLoader.addShaderProgram('calcMovement', 'calc_movement.vert.glsl', 'calc_movement.frag.glsl');
    


	shaderLoader.load(function(data) {

		var fullscreenVertexArray = createFullscreenVertexArray();

		var textureBlitShader = makeShader('textureBlit', data);
		blitTextureDrawCall = app.createDrawCall(textureBlitShader, fullscreenVertexArray);


        var applySIRMovementShader = makeShader('applySIRMovement', data);
        applySIRMovementDrawCall = app.createDrawCall(applySIRMovementShader, fullscreenVertexArray);

        var calcMovementShader = makeShader('calcMovement', data);
        calcMovementDrawCall = app.createDrawCall(calcMovementShader, fullscreenVertexArray);


        // var probeRadianceShader = makeShader('probeRadiance', data);
        // probeRadianceDrawCall = app.createDrawCall(probeRadianceShader, fullscreenVertexArray);

	});

    // TODO: loading
    computeNoiseTextures();
    // noiseTexture = makeNoiseTexture(noiseTextureWidth, noiseTextureHeight);
    SIRTexture = makeRandomSIRTexture(lattice_width, lattice_height, settings['initial_s'], settings['initial_i'], settings['initial_r']);


    setupSIRFramebuffer(lattice_width, lattice_height);
    setupMovementFramebuffer(lattice_width, lattice_height);

}

function setupSIRFramebuffer(width, height) {

    // var colorBuffer = app.createTexture2D(width, height, {
        // internalFormat: PicoGL.RGBA32F,
        // minFilter: PicoGL.NEAREST,
        // magFilter: PicoGL.NEAREST,
    // });
    var colorBuffer = SIRTexture;
    // colorBuffer.options['internalFormat'] = PicoGL.RGBA32F;
    // colorBuffer.options['minFilter'] = PicoGL.NEAREST;
    // colorBuffer.options['magFilter'] = PicoGL.NEAREST;
    var depthBuffer = app.createTexture2D(width, height, {
        format: PicoGL.DEPTH_COMPONENT
    });
    SIRFramebuffer = app.createFramebuffer()
        .colorTarget(0, colorBuffer)
        .depthTarget(depthBuffer);
}



function setupMovementFramebuffer(width, height) {

    // The sMove, iMove, rMove textures each store the movements in the directions right (red), up (green), left (blue), down (alpha)

    var sMove = app.createTexture2D(width, height, {
        internalFormat: PicoGL.RGBA32F,
        minFilter: PicoGL.NEAREST,
        magFilter: PicoGL.NEAREST,
    });
    var iMove = app.createTexture2D(width, height, {
        internalFormat: PicoGL.RGBA32F,
        minFilter: PicoGL.NEAREST,
        magFilter: PicoGL.NEAREST,
    });
    var rMove = app.createTexture2D(width, height, {
        internalFormat: PicoGL.RGBA32F,
        minFilter: PicoGL.NEAREST,
        magFilter: PicoGL.NEAREST,
    });

    // The sirStay texture stores the stay movements for S (red), I (green), R (blue)

    var sirStay = app.createTexture2D(width, height, {
        internalFormat: PicoGL.RGBA32F,
        minFilter: PicoGL.NEAREST,
        magFilter: PicoGL.NEAREST,
    });

    var depthBuffer = app.createTexture2D(width, height, {
        format: PicoGL.DEPTH_COMPONENT
    });
    movementFramebuffer = app.createFramebuffer()
        .colorTarget(0, sMove)
        .colorTarget(1, iMove)
        .colorTarget(2, rMove)
        .colorTarget(3, sirStay)
        .depthTarget(depthBuffer);

}

function computeNoiseTextures() {
    for (var i = 0; i < num_precomputed_noise_textures; i++) {
        noiseTextures[i] = makeNoiseTexture(noiseTextureWidth, noiseTextureHeight);
    }
}

function nextNoiseTexture() {
    if (noise_texture_index == num_precomputed_noise_textures) {
        computeNoiseTextures();
        noise_texture_index = 0;
    }
    var texture = noiseTextures[noise_texture_index];
    noise_texture_index += 1;
    return texture;
}

function makeNoiseTexture(width, height) {
    var options = {};
    options['minFilter'] = PicoGL.NEAREST;
    options['magFilter'] = PicoGL.NEAREST;
    options['mipmaps'] = false;
    options['format'] = PicoGL.RED;
    options['internalFormat'] = PicoGL.R32F;
    options['type'] = PicoGL.FLOAT;
    image_data = new Float32Array(width*height);
    for (var i = 0; i < width*height; i++) {
        image_data[i] = Math.random();
    }
    return app.createTexture2D(image_data, width, height, options);
}

function getRandomInt(stop) {
  return Math.floor(Math.random() * Math.floor(stop));
}

function makeRandomSIRTexture(width, height, S, I, R) {
    var options = {};
    options['minFilter'] = PicoGL.NEAREST;
    options['magFilter'] = PicoGL.NEAREST;
    options['mipmaps'] = false;
    options['format'] = PicoGL.RGBA;
    options['internalFormat'] = PicoGL.RGBA32F;
    options['type'] = PicoGL.FLOAT;
    image_data = new Float32Array(width * height * 4);
    for (var s = 0; s < S; s++) {
        var pos = getRandomInt(width*height);
        image_data[4*pos + 0]++;
    }
    for (var i = 0; i < I; i++) {
        var pos = getRandomInt(width*height);
        image_data[4*pos + 1]++;
    }
    for (var r = 0; r < R; r++) {
        var pos = getRandomInt(width*height);
        image_data[4*pos + 2]++;
    }
    image_data[4*pos + 3] = 1.0;
    return app.createTexture2D(image_data, width, height, options);
}

function initProbeToggleControls() {
    window.addEventListener('keydown', function(e) {
        if (e.keyCode === 80) { /* p */
            hideProbes = false;
            if (probeVisualizeUnlit) {
                probeVisualizeUnlit = false;
            } else {
                if (probeVisualizeMode === 'sh')
                    probeVisualizeMode = 'raw';
                else if (probeVisualizeMode === 'raw')
                    probeVisualizeMode = 'sh';
            }
        }
        if (e.keyCode === 85) { /* u */
			if (probeVisualizeUnlit && !hideProbes) {
				hideProbes = true;
			} else {
                probeVisualizeUnlit = true;
                hideProbes = false;
            }
        }
    });
}

function getProbeVisualizeModeString() {
    if (probeVisualizeUnlit) {
        return 'unlit';
    } else {
        return probeVisualizeMode;
    }
}

function createFullscreenVertexArray() {

	var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array([
		-1, -1, 0,
		+3, -1, 0,
		-1, +3, 0
	]));

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positions);

	return vertexArray;

}

function createSphereVertexArray(radius, rings, sectors) {

	var positions = [];

	var R = 1.0 / (rings - 1);
	var S = 1.0 / (sectors - 1);

	var PI = Math.PI;
	var TWO_PI = 2.0 * PI;

	for (var r = 0; r < rings; ++r) {
		for (var s = 0; s < sectors; ++s) {

			var y = Math.sin(-(PI / 2.0) + PI * r * R);
			var x = Math.cos(TWO_PI * s * S) * Math.sin(PI * r * R);
			var z = Math.sin(TWO_PI * s * S) * Math.sin(PI * r * R);

			positions.push(x * radius);
			positions.push(y * radius);
			positions.push(z * radius);

		}
	}

	var indices = [];

	for (var r = 0; r < rings - 1; ++r) {
		for (var s = 0; s < sectors - 1; ++s) {

			var i0 = r * sectors + s;
			var i1 = r * sectors + (s + 1);
			var i2 = (r + 1) * sectors + (s + 1);
			var i3 = (r + 1) * sectors + s;

			indices.push(i2);
			indices.push(i1);
			indices.push(i0);

			indices.push(i3);
			indices.push(i2);
			indices.push(i0);

		}
	}

	var positionBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array(positions));
	var indexBuffer = app.createIndexBuffer(PicoGL.UNSIGNED_SHORT, 3, new Uint16Array(indices));

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positionBuffer)
	.indexBuffer(indexBuffer);

	return vertexArray;

}

function setupDirectionalLightShadowMapFramebuffer(size) {

	var colorBuffer = app.createTexture2D(size, size, {
		format: PicoGL.RED,
		internalFormat: PicoGL.R32F,
	});

	var depthBuffer = app.createTexture2D(size, size, {
		format: PicoGL.DEPTH_COMPONENT,
		compareMode: PicoGL.COMPARE_REF_TO_TEXTURE,
		compareFunc: PicoGL.LEQUAL,
		minFilter: PicoGL.LINEAR,
		magFilter: PicoGL.LINEAR,

	});

	shadowMapFramebuffer = app.createFramebuffer()
	.colorTarget(0, colorBuffer)
	.depthTarget(depthBuffer);

}

var applyDictionaryFramebuffer;
function setupApplyDictFramebuffer(width, height)
{

	var colorBuffer = app.createTexture2D(width, height, {
		internalFormat: PicoGL.RGBA32F,
		minFilter: PicoGL.NEAREST,
		magFilter: PicoGL.NEAREST,
	});

	var depthBuffer = app.createTexture2D(width, height, {
		format: PicoGL.DEPTH_COMPONENT
	});

	applyDictionaryFramebuffer = app.createFramebuffer()
	.colorTarget(0, colorBuffer)
	.depthTarget(depthBuffer); 
	
	
}

var gilightMapFramebuffer = false;

function setupGILightmapFramebuffer(size) {

	var colorBuffer = app.createTexture2D(size, size, {
		internalFormat: PicoGL.RGBA16F,
		minFilter: PicoGL.LINEAR,
		magFilter: PicoGL.LINEAR,
		//wrapS:gl.CLAMP_TO_BORDER,
		//wrapT:gl.CLAMP_TO_BORDER,
	});
	// do we need to set border color -> 0? probs defult.
	// pico gl won't let us? :(

	// we don't need no depth texture.. are we allowed not to have one somehow?
	// not adding it causes it to be undefined...
	var depthBuffer = app.createTexture2D(size, size, {
		format: PicoGL.DEPTH_COMPONENT
	});

	gilightMapFramebuffer = app.createFramebuffer()
	.colorTarget(0, colorBuffer)
	.depthTarget(depthBuffer); 
}

var padDrawCall;
var padFBO;
function setupPaddingFbo(size)
{
	var colorBuffer = app.createTexture2D(size, size, {
		internalFormat: PicoGL.RGBA16F,
		minFilter: PicoGL.LINEAR,
		magFilter: PicoGL.LINEAR,
		//wrapS:gl.CLAMP_TO_BORDER,
		//wrapT:gl.CLAMP_TO_BORDER,
	});
	var depthBuffer = app.createTexture2D(size, size, {
		format: PicoGL.DEPTH_COMPONENT
	});

	padFBO = app.createFramebuffer()
	.colorTarget(0, colorBuffer)
	.depthTarget(depthBuffer);
}



function setupLightmapFramebuffer(size) {
	var colorBuffer = app.createTexture2D(size, size, {
		internalFormat: PicoGL.RGBA16F,
		minFilter: PicoGL.LINEAR,
		magFilter: PicoGL.LINEAR,
		//wrapS:gl.CLAMP_TO_BORDER,
		//wrapT:gl.CLAMP_TO_BORDER,
	});
	// do we need to set border color -> 0? probs defult.
	// pico gl won't let us? :(

	// we don't need no depth texture.. are we allowed not to have one somehow?
	// not adding it causes it to be undefined...
	var depthBuffer = app.createTexture2D(size, size, {
		format: PicoGL.DEPTH_COMPONENT
	});

	lightMapFramebuffer = app.createFramebuffer()
	.colorTarget(0, colorBuffer)
	.depthTarget(depthBuffer); 
}

function setupProbeRadianceFramebuffer() {

    var colorBuffer = app.createTexture2D(num_sh_coefficients, num_probes, {
        internalFormat: PicoGL.RGBA16F,
        minFilter: PicoGL.NEAREST,
        magFilter: PicoGL.NEAREST,
	});
    var depthBuffer = app.createTexture2D(num_sh_coefficients, num_probes, {
        format: PicoGL.DEPTH_COMPONENT
    });
    probeRadianceFramebuffer = app.createFramebuffer()
        .colorTarget(0, colorBuffer)
        .depthTarget(depthBuffer);
}

function setupSceneUniforms() {

	//
	// TODO: Fix all this! I got some weird results when I tried all this before but it should work...
	//

	sceneUniforms = app.createUniformBuffer([
		PicoGL.FLOAT_VEC4 /* 0 - ambient color */   //,
		//PicoGL.FLOAT_VEC4 /* 1 - directional light color */,
		//PicoGL.FLOAT_VEC4 /* 2 - directional light direction */,
		//PicoGL.FLOAT_MAT4 /* 3 - view from world matrix */,
		//PicoGL.FLOAT_MAT4 /* 4 - projection from view matrix */
	])
	.set(0, sceneSettings.ambientColor)
	//.set(1, directionalLight.color)
	//.set(2, directionalLight.direction)
	//.set(3, camera.viewMatrix)
	//.set(4, camera.projectionMatrix)
	.update();

/*
	camera.onViewMatrixChange = function(newValue) {
		sceneUniforms.set(3, newValue).update();
	};

	camera.onProjectionMatrixChange = function(newValue) {
		sceneUniforms.set(4, newValue).update();
	};
*/

}

function createVertexArrayFromMeshInfo(meshInfo) {

	var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.positions);
	var normals   = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.normals);
	var tangents  = app.createVertexBuffer(PicoGL.FLOAT, 4, meshInfo.tangents);
	var texCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, meshInfo.uvs);
	var lightmapCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, meshInfo.uv2s);

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positions)
	.vertexAttributeBuffer(1, normals)
	.vertexAttributeBuffer(2, texCoords)
	.vertexAttributeBuffer(3, tangents)
	.vertexAttributeBuffer(4, lightmapCoords);

	return vertexArray;

}

function createVertexArrayFromMeshInfoUV2(meshInfo) {

    var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.positions);
    var normals   = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.normals);
    var tangents  = app.createVertexBuffer(PicoGL.FLOAT, 4, meshInfo.tangents);
    var texCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, meshInfo.uvs);
    var lightmapCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, meshInfo.uv2s);

    var vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, positions)
        .vertexAttributeBuffer(1, normals)
        .vertexAttributeBuffer(2, texCoords)
        .vertexAttributeBuffer(3, tangents)
        .vertexAttributeBuffer(4, lightmapCoords);

    return vertexArray;

}

function createVertexArrayFromMeshInfo(meshInfo) {

    var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.positions);
    var normals   = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.normals);
    var tangents  = app.createVertexBuffer(PicoGL.FLOAT, 4, meshInfo.tangents);
    var texCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, meshInfo.uvs);

    var vertexArray = app.createVertexArray()
        .vertexAttributeBuffer(0, positions)
        .vertexAttributeBuffer(1, normals)
        .vertexAttributeBuffer(2, texCoords)
        .vertexAttributeBuffer(3, tangents);

    return vertexArray;

}



function setupProbeDrawCalls(vertexArray, unlitShader, probeVisualizeSHShader, probeVisualizeRawShader) {

	// We need at least one (x,y,z) pair to render any probes
	if (!probeLocations || probeLocations.length <= 3) {
		return;
	}

	if (probeLocations.length % 3 !== 0) {
		console.error('Probe locations invalid! Number of coordinates is not divisible by 3.');
		return;
	}

	num_probes = probeLocations.length / 3;

	// Set up for instanced drawing at the probe locations
	var translations = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array(probeLocations))
	vertexArray.instanceAttributeBuffer(10, translations);

	probeDrawCall = app.createDrawCall(unlitShader, vertexArray)
	.uniform('u_color', vec3.fromValues(0, 1, 0));

	probeVisualizeSHDrawCall = app.createDrawCall(probeVisualizeSHShader, vertexArray);
	probeVisualizeRawDrawCall = app.createDrawCall(probeVisualizeRawShader, vertexArray);
}

////////////////////////////////////////////////////////////////////////////////

function resize() {

	// var w = window.innerWidth;
	// var h = window.innerHeight;
	// w = 1920;//*0.8;
	// h = 1080;//*0.8;

    var w = 6*lattice_width;
    var h = 6*lattice_height;


	app.resize(w, h);
	camera.resize(w, h);

}

////////////////////////////////////////////////////////////////////////////////
// Rendering

function render() {
	var startStamp = new Date().getTime();

	stats.begin();
	picoTimer.start();
	{

		// if (settings["rotate_light"]) {
            // Rotate light
            // vec3.rotateY(directionalLight.direction, directionalLight.direction, vec3.fromValues(0.0,0.0,0.0), 0.01);
        // }


        // camera.update();

        // debugMoveDynamicObject();

		// if (!bakedDirect) {
            // renderShadowMap();
        // }


        // var lightmap = lightMapFramebuffer.colorTextures[0];
        // renderProbeRadiance(relight_uvs_texture, relight_shs_texture, lightmap);

		// renderLightmap();
		// if(settings.redraw_global_illumination)
		// {
			// if(compressed)
			// {
				// render_apply_dictionary();
				// render_gi();
			// }
			// else{
				// render_gi_uncompressed();
			// }
		// }


        // if (settings.lightmap_only) {
        	// renderSceneTexturedByLightMap();
		// } else {
            // renderScene();
        // }

		// var viewProjection = mat4.mul(mat4.create(), camera.projectionMatrix, camera.viewMatrix);
		// if (!hideProbes) {
            // renderProbes(viewProjection, getProbeVisualizeModeString()); // 'unlit' | 'sh' | 'raw'
        // }

		// var inverseViewProjection = mat4.invert(mat4.create(), viewProjection);
		// renderEnvironment(inverseViewProjection)

		

        // renderTextureToScreen(noiseTexture);
        // renderTextureToScreen(SIRTexture);

        // applySIRMovement();

        // noiseTexture = makeNoiseTexture(noiseTextureWidth, noiseTextureHeight);
        computeNoiseTextures();
        for (var step = 0; step < settings['steps_per_frame']; step++) {
            // noiseTexture = makeNoiseTexture(noiseTextureWidth, noiseTextureHeight);
            var noiseTexture = nextNoiseTexture();
            calculateSIRMovement(noiseTexture);
            // noiseTexture = makeNoiseTexture(noiseTextureWidth, noiseTextureHeight);
            var noiseTexture = nextNoiseTexture();
            applySIRMovement(noiseTexture);
        }
        renderTextureToScreen(SIRFramebuffer.colorTextures[0]);


        // renderTextureToScreen(movementFramebuffer.colorTextures[0]);
        



        // Call this to get a debug render of the passed in texture
		if(settings.view_lightmap){
			renderTextureToScreen(lightMapFramebuffer.colorTextures[0]);
		}
		
		if(gilightMapFramebuffer && settings.view_gi_lightmap)
		{
			renderTextureToScreen(gilightMapFramebuffer.colorTextures[0]);
		}

		if(gilightMapFramebuffer && settings.view_padded)
		{
			renderTextureToScreen(padFBO.colorTextures[0]);
		}

		if(applyDictionaryFramebuffer && settings.view_trans_pc)
		{
			renderTextureToScreen(applyDictionaryFramebuffer.colorTextures[0]);
		}
	}
	picoTimer.end();
	stats.end();

	if (picoTimer.ready()) {
		gpuTimePanel.update(picoTimer.gpuTime, 35);
	}

	var renderDelta = new Date().getTime() - startStamp;
	setTimeout( function() {
		requestAnimationFrame(render);
	}, 1000 / settings.target_fps - renderDelta-1000/120);

}

function shadowMapNeedsRendering() {

	var lastDirection = shadowMapNeedsRendering.lastDirection || vec3.create();
	var lastMeshCount = shadowMapNeedsRendering.lastMeshCount || 0;

	if (vec3.equals(lastDirection, directionalLight.direction) && lastMeshCount === meshes.length) {

		return false;

	} else {

		shadowMapNeedsRendering.lastDirection = vec3.copy(lastDirection, directionalLight.direction);
		shadowMapNeedsRendering.lastMeshCount = meshes.length;

		return true;

	}


}

function renderShadowMap() {

	if (!directionalLight) return;
	if (!shadowMapNeedsRendering()) return;

	var lightViewProjection = directionalLight.getLightViewProjectionMatrix();

	app.drawFramebuffer(shadowMapFramebuffer)
	.viewport(0, 0, shadowMapSize, shadowMapSize)
	.depthTest()
	.depthFunc(PicoGL.LEQUAL)
	.noBlend()
	.clear();

	for (var i = 0, len = meshes.length; i < len; ++i) {

		var mesh = meshes[i];

		mesh.shadowMapDrawCall
		.uniform('u_world_from_local', mesh.modelMatrix)
		.uniform('u_light_projection_from_world', lightViewProjection)
		.draw();

	}
}

function renderLightmap() {
	var dirLightViewDirection = directionalLight.viewSpaceDirection(camera);
	var lightViewProjection = directionalLight.getLightViewProjectionMatrix();
	var shadowMap = shadowMapFramebuffer.depthTexture;
	var lightMap;
	if(compressed) lightMap = gilightMapFramebuffer.colorTextures[0];
	else lightMap = padFBO.colorTextures[0];

	app.drawFramebuffer(lightMapFramebuffer)
	.viewport(0, 0, lightMapSize, lightMapSize)
	.noDepthTest()
	.noBlend()
	.clearColor(0,0,0)
	.drawBackfaces()
	.clear();

	for (var i = 0, len = staticMeshes.length; i < len; ++i) {
		var mesh = staticMeshes[i];
		if (bakedDirect) {
            mesh.lightmapDrawCall
                .uniform('u_world_from_local', mesh.modelMatrix)
                .uniform('u_view_from_world', camera.viewMatrix)
                .uniform('u_light_projection_from_world', lightViewProjection)
                .texture('u_light_map', lightMap)
                .texture('u_baked_direct', bakedDirect)
                .draw();
		} else {
            mesh.lightmapDrawCall
                .uniform('u_world_from_local', mesh.modelMatrix)
                .uniform('u_view_from_world', camera.viewMatrix)
                .uniform('u_dir_light_color', vec3.fromValues(directionalLight.color[0]*settings.lightIntensity, directionalLight.color[1]*settings.lightIntensity, directionalLight.color[2]*settings.lightIntensity))
                .uniform('u_dir_light_view_direction', dirLightViewDirection)
                .uniform('u_light_projection_from_world', lightViewProjection)
                .texture('u_shadow_map', shadowMap)
                .texture('u_light_map', lightMap)
                .draw();
        }
	}
}

function render_apply_dictionary()
{
	if(dict && applyDictionaryFramebuffer && probeRadianceFramebuffer && applyDictDrawCall)
	{
		app.drawFramebuffer(applyDictionaryFramebuffer)
		.viewport(0, 0, 1024, 1)
		.noDepthTest()
		.noBlend()
		.clearColor(0,0,0)
		.clear();

		applyDictDrawCall
		.texture('sigma_v', dict)
		.texture('sh_coeffs', probeRadianceFramebuffer.colorTextures[0])
		.draw();
	}
	
}

function render_gi()
{
	if(applyDictionaryFramebuffer && gilightMapFramebuffer)
	{
		app.drawFramebuffer(gilightMapFramebuffer)
		.viewport(0, 0, giLightMapSize, giLightMapSize)
		.noDepthTest()
		.noBlend()
		.clearColor(0,0,0)
		.clear();

		GIDrawCall
		.texture('dictionary', applyDictionaryFramebuffer.colorTextures[0])
		.draw();
	}
	
}

function render_gi_uncompressed()
{
	if(probeRadianceFramebuffer && full_texture && gilightMapFramebuffer)
	{
		app.drawFramebuffer(gilightMapFramebuffer)
		.viewport(0, 0, giLightMapSize, giLightMapSize)
		.noDepthTest()
		.noBlend()
		.clearColor(0,0,0)
		.clear();
		
		GIDrawCall
		.texture('probes_sh_coeffs',probeRadianceFramebuffer.colorTextures[0])
		.texture('rec_sh_coeffs', full_texture).draw();

		app.drawFramebuffer(padFBO)
		.viewport(0, 0, giLightMapSize, giLightMapSize)
		.noDepthTest()
		.noBlend()
		.clearColor(0,0,0)
		.clear();

		padDrawCall.texture('u_texture', gilightMapFramebuffer.colorTextures[0]).draw();
	}
}

function renderScene() {

	var dirLightViewDirection = directionalLight.viewSpaceDirection(camera);
	var lightViewProjection = directionalLight.getLightViewProjectionMatrix();
	var shadowMap = shadowMapFramebuffer.depthTexture;
	//var lightMap = lightMapFramebuffer.colorTextures[0];
	if(compressed)
	{
		if(gilightMapFramebuffer) lightMap = gilightMapFramebuffer.colorTextures[0];
	}
	else{
		if(padFBO) lightMap = padFBO.colorTextures[0];
	}


	app.defaultDrawFramebuffer()
	.defaultViewport()
	.depthTest()
	.depthFunc(PicoGL.LEQUAL)
	.noBlend()
	.clear();

	for (var i = 0, len = meshes.length; i < len; ++i) {
		var mesh = meshes[i];
		if (mesh.isDynamic) {
			mesh.drawCall
				.uniform('u_world_from_local', mesh.modelMatrix)
				.uniform('u_view_from_world', camera.viewMatrix)
				.uniform('u_projection_from_view', camera.projectionMatrix)
				.uniform('u_dir_light_color', vec3.fromValues(directionalLight.color[0]*settings.lightIntensity, directionalLight.color[1]*settings.lightIntensity, directionalLight.color[2]*settings.lightIntensity))
				.uniform('u_dir_light_view_direction', dirLightViewDirection)
				.uniform('u_light_projection_from_world', lightViewProjection)
				.texture('u_shadow_map', shadowMap)
                .texture('u_probe_sh_texture', probeRadianceFramebuffer.colorTextures[0])
				.draw();

		} else {
            if (bakedDirect) {
                mesh.drawCall
                    .uniform('u_world_from_local', mesh.modelMatrix)
                    .uniform('u_view_from_world', camera.viewMatrix)
                    .uniform('u_projection_from_view', camera.projectionMatrix)
                    .uniform('u_light_projection_from_world', lightViewProjection)
                    .texture('u_light_map', lightMap)
                    .texture('u_baked_direct', bakedDirect)
                    .draw();
            } else {
                mesh.drawCall
                    .uniform('u_world_from_local', mesh.modelMatrix)
                    .uniform('u_view_from_world', camera.viewMatrix)
                    .uniform('u_projection_from_view', camera.projectionMatrix)
                    .uniform('u_dir_light_color', vec3.fromValues(directionalLight.color[0]*settings.lightIntensity, directionalLight.color[1]*settings.lightIntensity, directionalLight.color[2]*settings.lightIntensity))
                    .uniform('u_dir_light_view_direction', dirLightViewDirection)
                    .uniform('u_light_projection_from_world', lightViewProjection)
                    .texture('u_shadow_map', shadowMap)
                    .texture('u_light_map', lightMap)
                    .draw();
            }
		}

	}
}

function renderSceneTexturedByLightMap() {
	if(!gilightMapFramebuffer)return;
    app.defaultDrawFramebuffer()
        .defaultViewport()
        .depthTest()
        .depthFunc(PicoGL.LEQUAL)
        .noBlend()
        .clear();

    for (var i = 0, len = staticMeshes.length; i < len; ++i) {
        var mesh = staticMeshes[i];
        mesh.texturedByLightmapDrawCall
            .uniform('u_world_from_local', mesh.modelMatrix)
            .uniform('u_view_from_world', camera.viewMatrix)
            .uniform('u_projection_from_view', camera.projectionMatrix)
            .texture('u_light_map', padFBO.colorTextures[0])
            .draw();
    }
}


function renderProbes(viewProjection, type) {

    app.defaultDrawFramebuffer()
        .defaultViewport()
        .depthTest()
        .depthFunc(PicoGL.LEQUAL)
        .noBlend();

    switch(type) {
        case 'unlit':
            if (probeDrawCall) {
                probeDrawCall
                    .uniform('u_projection_from_world', viewProjection)
                    .draw();
            }
            break;
        case 'sh':
            if (probeVisualizeSHDrawCall && probeRadianceFramebuffer) {
                probeVisualizeSHDrawCall
                    .uniform('u_projection_from_world', viewProjection)
                    .uniform('u_num_sh_coeffs_to_render', settings['num_sh_coeffs_to_render'])
                    .texture('u_probe_sh_texture', probeRadianceFramebuffer.colorTextures[0])
					.draw();
            }
            break;
        case 'raw':
            if (probeVisualizeRawDrawCall && lightMapFramebuffer && relight_dirs_texture && relight_uvs_texture) {
                probeVisualizeRawDrawCall
                    .uniform('u_projection_from_world', viewProjection)
                    .texture('u_relight_uvs_texture', relight_uvs_texture)
                    .texture('u_relight_dirs_texture', relight_dirs_texture)
					.texture('u_lightmap', lightMapFramebuffer.colorTextures[0])
                    .draw();
            }
            break;
    }


}

function renderEnvironment(inverseViewProjection) {

	if (environmentDrawCall) {

		app.defaultDrawFramebuffer()
		.defaultViewport()
		.depthTest()
		.depthFunc(PicoGL.EQUAL)
		.noBlend();

		environmentDrawCall
		.uniform('u_camera_position', camera.position)
		.uniform('u_world_from_projection', inverseViewProjection)
		.uniform('u_environment_brightness', settings.environment_brightness)
		.draw();

	}

}

function renderTextureToScreen(texture) {

	//
	// NOTE:
	//
	//   This function can be really helpful for debugging!
	//   Just call this whenever and you get the texture on
	//   the screen (just make sure nothing is drawn on top)
	//

	if (!blitTextureDrawCall) {
		return;
	}

	app.defaultDrawFramebuffer()
	.defaultViewport()
	.noDepthTest()
	.noBlend();

	blitTextureDrawCall
	.texture('u_texture', texture)
	.draw();

}

function calculateSIRMovement(noiseTexture) {

    if (!calcMovementDrawCall || !movementFramebuffer) {
        return;
    }

    app.drawFramebuffer(movementFramebuffer)
        .viewport(0, 0, lattice_width, lattice_height)
        .noDepthTest()
        .noBlend()
        .clearColor(0,0,0)
        .clear();

    calcMovementDrawCall
        .uniform('u_diffusion_rate', settings['diffusion_rate'])
        .uniform('u_num_rands_per_pixel', num_rands_per_pixel)
        .uniform('u_lattice_width', lattice_width)
        .texture('u_SIRTexture', SIRFramebuffer.colorTextures[0])
        .texture('u_noiseTexture', noiseTexture)
        .draw();
    // blitTextureDrawCall
    // .texture('u_texture', SIRTexture)
    // .draw();

}

function applySIRMovement(noiseTexture) {

    if (!applySIRMovementDrawCall || !SIRFramebuffer) {
        return;
    }

    app.drawFramebuffer(SIRFramebuffer)
        .viewport(0, 0, lattice_width, lattice_height)
        .noDepthTest()
        .noBlend()
        .clearColor(0,0,0)
        .clear();

    applySIRMovementDrawCall
        .uniform('u_transmission_rate', settings['transmission_rate'])
        .uniform('u_recovery_rate', settings['recovery_rate'])
        .uniform('u_num_rands_per_pixel', num_rands_per_pixel)
        .uniform('u_lattice_width', lattice_width)
        .uniform('u_lattice_height', lattice_height)
        .texture('u_s_move_texture', movementFramebuffer.colorTextures[0])
        .texture('u_i_move_texture', movementFramebuffer.colorTextures[1])
        .texture('u_r_move_texture', movementFramebuffer.colorTextures[2])
        .texture('u_sir_stay_texture', movementFramebuffer.colorTextures[3])
        .texture('u_noiseTexture', noiseTexture)
        .draw();
    // blitTextureDrawCall
    // .texture('u_texture', SIRTexture)
    // .draw();

}

function renderProbeRadiance(relight_uvs_texture, relight_shs_texture, lightmap) {

    if (!probeRadianceDrawCall || !probeRadianceFramebuffer) {
        return;
    }

    app.drawFramebuffer(probeRadianceFramebuffer)
        .viewport(0, 0, num_sh_coefficients, num_probes)
        .noDepthTest()
        .noBlend()
        .clearColor(0,0,0)
        .clear();

    probeRadianceDrawCall
		.uniform('u_num_sh_coeffs_to_render', settings['num_sh_coeffs_to_render'])
        .texture('u_relight_uvs_texture', relight_uvs_texture)
        .texture('u_relight_shs_texture', relight_shs_texture)
		.texture('u_lightmap', lightmap)
        .draw();

}

////////////////////////////////////////////////////////////////////////////////
