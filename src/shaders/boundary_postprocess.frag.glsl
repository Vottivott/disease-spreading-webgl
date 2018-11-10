#version 300 es
precision highp float;

in vec2 v_tex_coord;


uniform sampler2D u_SIRTexture;

layout(location = 0) out vec4 o_color;


void main()
{
    int x = int(gl_FragCoord.x);
    int y = int(gl_FragCoord.y);

    o_color = vec4(0.0, 0.0, 0.0, 1.0);

    // vec3 SIR = texelFetch(u_SIRTexture, ivec2(x, y), 0).rgb;
    // int S = int(SIR.r);
    // int I = int(SIR.g);
    // int R = int(SIR.b);

    vec4 px = texelFetch(u_SIRTexture, ivec2(x,y), 0);

    o_color = vec4((px.rgb+0.5) / 255.0,1.0);




}

// void main()
// {
//     int x = int(gl_FragCoord.x);
//     int y = int(gl_FragCoord.y);

//     o_color = vec4(0.0, 0.0, 0.0, 1.0);

//     // vec3 SIR = texelFetch(u_SIRTexture, ivec2(x, y), 0).rgb;
//     // int S = int(SIR.r);
//     // int I = int(SIR.g);
//     // int R = int(SIR.b);

//     vec4 sum = vec4(0.0);
//     vec4 px = texelFetch(u_SIRTexture, ivec2(x+1,y), 0); float r = clamp(px.r,0.0,1.0); float g = clamp(px.g,0.0,1.0); float b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x+1,y+1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x,y+1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x-1,y+1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x-1,y), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x-1,y-1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x,y-1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x+1,y-1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);

//     px = texelFetch(u_SIRTexture, ivec2(x,y), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);

//     // if (sum.r > sum.g && sum.r > sum.b)
//     //     o_color = vec4(1.0,0.0,0.0,1.0);
//     // else if (sum.g > sum.b)
//     //     o_color = vec4(0.0,1.0,0.0,1.0);
//     // else
//     //     o_color = vec4(0.0,0.0,1.0,1.0);

//     o_color = vec4(sum.rgb,1.0);




// }



// void main()
// {
//     int x = int(gl_FragCoord.x);
//     int y = int(gl_FragCoord.y);

//     o_color = vec4(0.0, 0.0, 0.0, 1.0);

//     // vec3 SIR = texelFetch(u_SIRTexture, ivec2(x, y), 0).rgb;
//     // int S = int(SIR.r);
//     // int I = int(SIR.g);
//     // int R = int(SIR.b);

//     vec4 sum = vec4(0.0);
//     vec4 px = texelFetch(u_SIRTexture, ivec2(x+1,y), 0); float r = clamp(px.r,0.0,1.0); float g = clamp(px.g,0.0,1.0); float b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x+1,y+1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x,y+1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x-1,y+1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x-1,y), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x-1,y-1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x,y-1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);
//     px = texelFetch(u_SIRTexture, ivec2(x+1,y-1), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);

//     px = texelFetch(u_SIRTexture, ivec2(x,y), 0); r = clamp(px.r,0.0,1.0); g = clamp(px.g,0.0,1.0); b = clamp(px.b,0.0,1.0); sum+=vec4(r,g,b,0.0);


//     o_color = vec4(sum.rgb / 9.0, 1.0);



// }




// void main()
// {
//     int x = int(gl_FragCoord.x);
//     int y = int(gl_FragCoord.y);

//     o_color = vec4(0.0, 0.0, 0.0, 1.0);

//     // vec3 SIR = texelFetch(u_SIRTexture, ivec2(x, y), 0).rgb;
//     // int S = int(SIR.r);
//     // int I = int(SIR.g);
//     // int R = int(SIR.b);

//     float maxS = 0.0;
//     float maxI = 0.0;
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x+1,y), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x+1,y), 0).g);
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x+1,y+1), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x+1,y+1), 0).g);
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x,y+1), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x,y+1), 0).g);
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x-1,y+1), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x-1,y+1), 0).g);
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x-1,y), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x-1,y), 0).g);
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x-1,y-1), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x-1,y-1), 0).g);
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x,y-1), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x,y-1), 0).g);
//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x+1,y-1), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x+1,y-1), 0).g);

//     maxS = max(maxS, texelFetch(u_SIRTexture, ivec2(x,y), 0).r); maxI = max(maxI, texelFetch(u_SIRTexture, ivec2(x,y), 0).g);

//     if (maxS > 0.0 && maxI > 0.0) {
//         o_color = vec4(0.0,0.0,0.0,1.0);
//     } else {
//         o_color = vec4(1.0,1.0,1.0,1.0);
//     }


// }

