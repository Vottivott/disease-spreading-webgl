#version 300 es
precision highp float;

in vec2 v_tex_coord;

//uniform int u_num_sh_coeffs_to_render;


uniform sampler2D u_SIRTexture;
uniform sampler2D u_noiseTexture;
uniform float u_rand;

uniform float u_diffusion_rate;
uniform float u_num_rands_per_pixel;
uniform int u_lattice_width;
uniform int u_lattice_height;
uniform bool u_periodic_boundary;
uniform bool u_true_randomness;

layout(location = 0) out vec4 o_s_move; // R = right, G = up, B = left, A = down 
layout(location = 1) out vec4 o_i_move; // R = right, G = up, B = left, A = down
layout(location = 2) out vec4 o_r_move; // R = right, G = up, B = left, A = down
layout(location = 3) out vec4 o_sir_stay; // R = s, G = i, B = r

highp float random2(vec2 co)
{
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}

float random(int x, int y, int local_agent_index) {
    float texture_rand = texelFetch(u_noiseTexture, ivec2(y*u_lattice_width + x, mod(float(local_agent_index), u_num_rands_per_pixel)), 0).r;
    if (u_true_randomness) {
        return texture_rand;   // Assumes that the texture is updated between every rendering call  
    } else {
        return random2(vec2(float(y*u_lattice_width + x) / float(u_lattice_width * u_lattice_height),  (u_rand + mod(float(local_agent_index), u_num_rands_per_pixel)/u_num_rands_per_pixel) / 2.0 ));;
    }
}



// highp float random(vec2 co)
// {
//     highp float a = 12.9898;
//     highp float b = 78.233;
//     highp float c = 43758.5453;
//     highp float dt= dot(co.xy ,vec2(a,b));
//     highp float sn= mod(dt,3.14);
//     return fract(sin(sn) * c);
// }

void main()
{
    int x = int(gl_FragCoord.x);
    int y = int(gl_FragCoord.y);

    o_s_move = vec4(0.0);
    o_i_move = vec4(0.0);
    o_r_move = vec4(0.0);
    o_sir_stay = vec4(0.0, 0.0, 0.0, 1.0);

    vec3 SIR = texelFetch(u_SIRTexture, ivec2(x, y), 0).rgb;
    int S = int(SIR.r);
    int I = int(SIR.g);
    int R = int(SIR.b);

    for (int i = 0; i < S; i++) {
        float rand = random(x,y,i);
        if (rand < u_diffusion_rate) {
            rand /= u_diffusion_rate;
            if (rand < 0.25) {
                o_s_move.r++; //right++;
            } else if (rand < 0.5) {
                o_s_move.g++; //up++;
            } else if (rand < 0.75) {
                o_s_move.b++; //left++;
            } else {
                o_s_move.a++; //down++;
            }
        } else {
            o_sir_stay.r++; //stay++;
        }
    }

    for (int i = 0; i < I; i++) {
        float rand = random(x,y,S+i);
        if (rand < u_diffusion_rate) {
            rand /= u_diffusion_rate;
            if (rand < 0.25) {
                o_i_move.r++; //right++;
            } else if (rand < 0.5) {
                o_i_move.g++; //up++;
            } else if (rand < 0.75) {
                o_i_move.b++; //left++;
            } else {
                o_i_move.a++; //down++;
            }
        } else {
            o_sir_stay.g++; //stay++;
        }
    }

    for (int i = 0; i < R; i++) {
        float rand = random(x,y,S+I+i);
        if (rand < u_diffusion_rate) {
            rand /= u_diffusion_rate;
            if (rand < 0.25) {
                o_r_move.r++; //right++;
            } else if (rand < 0.5) {
                o_r_move.g++; //up++;
            } else if (rand < 0.75) {
                o_r_move.b++; //left++;
            } else {
                o_r_move.a++; //down++;
            }
        } else {
            o_sir_stay.b++; //stay++;
        }
    }

    if (!u_periodic_boundary) {
        if (x == u_lattice_width-1) {
            o_sir_stay.r += o_s_move.r; o_s_move.r = 0.0;
            o_sir_stay.g += o_i_move.r; o_i_move.r = 0.0;
            o_sir_stay.b += o_r_move.r; o_r_move.r = 0.0;
        }
        if (x == 0) {
            o_sir_stay.r += o_s_move.b; o_s_move.b = 0.0;
            o_sir_stay.g += o_i_move.b; o_i_move.b = 0.0;
            o_sir_stay.b += o_r_move.b; o_r_move.b = 0.0;
        }
        if (y == u_lattice_height-1) {
            o_sir_stay.r += o_s_move.g; o_s_move.g = 0.0;
            o_sir_stay.g += o_i_move.g; o_i_move.g = 0.0;
            o_sir_stay.b += o_r_move.g; o_r_move.g = 0.0;
        }
        if (y == 0) {
            o_sir_stay.r += o_s_move.a; o_s_move.a = 0.0;
            o_sir_stay.g += o_i_move.a; o_i_move.a = 0.0;
            o_sir_stay.b += o_r_move.a; o_r_move.a = 0.0;
        }
    }



}

