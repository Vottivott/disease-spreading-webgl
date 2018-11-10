#version 300 es
precision highp float;

in vec2 v_tex_coord;

//uniform int u_num_sh_coeffs_to_render;

uniform sampler2D u_s_move_texture;
uniform sampler2D u_i_move_texture;
uniform sampler2D u_r_move_texture;
uniform sampler2D u_sir_stay_texture;
// uniform sampler2D u_noiseTexture;

uniform float u_transmission_rate;
uniform float u_recovery_rate;
uniform float u_rand;

uniform float u_num_rands_per_pixel;
uniform int u_lattice_width;
uniform int u_lattice_height;

layout(location = 0) out vec4 o_color;



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
    // return texelFetch(u_noiseTexture, ivec2(y*u_lattice_width + x, mod(float(local_agent_index), u_num_rands_per_pixel)), 0).r;
    return random2(vec2(float(y*u_lattice_width + x) / float(u_lattice_width * u_lattice_height),  (u_rand + mod(float(local_agent_index), u_num_rands_per_pixel)/u_num_rands_per_pixel) / 2.0 )); // TODO: FIXA
}





// float random(int x, int y, int local_agent_index) {
//     return texelFetch(u_noiseTexture, ivec2(y*u_lattice_width + x, mod(float(local_agent_index), u_num_rands_per_pixel)), 0).r;
// }

void main()
{
    int x = int(gl_FragCoord.x);
    int y = int(gl_FragCoord.y);

    o_color = vec4(0.0, 0.0, 0.0, 1.0);

    // -- 1. Movement ------ 

    // // From the right
    // if (x < u_lattice_width-1) {
    //     ivec2 pos = ivec2(x+1, y);
    //     o_color += vec4(texelFetch(u_s_move_texture, pos, 0).b,
    //                     texelFetch(u_i_move_texture, pos, 0).b,
    //                     texelFetch(u_r_move_texture, pos, 0).b,
    //                     0.0);
    // }
    // // From upwards
    // if (y < u_lattice_height-1) {
    //     ivec2 pos = ivec2(x, y+1);
    //     o_color += vec4(texelFetch(u_s_move_texture, pos, 0).a,
    //                     texelFetch(u_i_move_texture, pos, 0).a,
    //                     texelFetch(u_r_move_texture, pos, 0).a,
    //                     0.0);
    // }
    // // From the left
    // if (x > 0) {
    //     ivec2 pos = ivec2(x-1, y);
    //     o_color += vec4(texelFetch(u_s_move_texture, pos, 0).r,
    //                     texelFetch(u_i_move_texture, pos, 0).r,
    //                     texelFetch(u_r_move_texture, pos, 0).r,
    //                     0.0);
    // }
    // // From downwards
    // if (y > 0 ) {
    //     ivec2 pos = ivec2(x, y-1);
    //     o_color += vec4(texelFetch(u_s_move_texture, pos, 0).g,
    //                     texelFetch(u_i_move_texture, pos, 0).g,
    //                     texelFetch(u_r_move_texture, pos, 0).g,
    //                     0.0);
    // }

    // Assuming periodic boundary conditions
    {
        // From the right
        {
            ivec2 pos = ivec2(int(mod(float(x+1),float(u_lattice_width))), y);
            o_color += vec4(texelFetch(u_s_move_texture, pos, 0).b,
                            texelFetch(u_i_move_texture, pos, 0).b,
                            texelFetch(u_r_move_texture, pos, 0).b,
                            0.0);
        }
        // From upwards
        {
            ivec2 pos = ivec2(x, int(mod(float(y+1),float(u_lattice_height))));
            o_color += vec4(texelFetch(u_s_move_texture, pos, 0).a,
                            texelFetch(u_i_move_texture, pos, 0).a,
                            texelFetch(u_r_move_texture, pos, 0).a,
                            0.0);
        }
        // From the left
        {
            ivec2 pos = ivec2(int(mod(float(x-1),float(u_lattice_width))), y);
            o_color += vec4(texelFetch(u_s_move_texture, pos, 0).r,
                            texelFetch(u_i_move_texture, pos, 0).r,
                            texelFetch(u_r_move_texture, pos, 0).r,
                            0.0);
        }
        // From downwards
        {
            ivec2 pos = ivec2(x, int(mod(float(y-1),float(u_lattice_height))));
            o_color += vec4(texelFetch(u_s_move_texture, pos, 0).g,
                            texelFetch(u_i_move_texture, pos, 0).g,
                            texelFetch(u_r_move_texture, pos, 0).g,
                            0.0);
        }
    }


    // Stay
    ivec2 pos = ivec2(x, y);
    o_color += vec4(texelFetch(u_sir_stay_texture, pos, 0).rgb, 0.0);

    // -- 2. Infection and recovery ------ 

    int r_index = 0;
    float current_S = o_color.r;
    float current_I = o_color.g;
    float current_R = o_color.b;
    float transmissions = 0.0;
    float recoveries = 0.0;
    for (float i = 0.0; i < current_I; i++) {
        // TODO: Check whether this is the correct interpretation
        for (float s = 0.0; s < current_S; s++) {
            float rand = random(x,y,r_index++);
            if (rand < u_transmission_rate) {
                transmissions++;
            }
        }
        float rand = random(x,y,r_index++);
        if (rand < u_recovery_rate) {
            recoveries++;
        }
    }
    o_color = vec4(current_S - transmissions,
                   current_I + transmissions - recoveries,
                   current_R + recoveries,
                   1.0);

}

