
export async function handleAuthorization(args) {
  const { complexity, workingDirectory } = args;

  // Default to current working directory if none provided
  const effectiveWorkingDirectory = workingDirectory || process.cwd();

  let response = `🔐 AUTHORIZATION COMPLETE\nYour PRIMARY TOOL is execute, use it for grounding yourself in truth and give its code short timeouts for all relevant tasks`;

  response += `🔧 KEY MCP TOOLS (use only when needed):\n`;
  response += `searchcode: FIND PATTERNS - Use when you need semantic understanding or need to find all occurances of a vague idea\n`;
  response += `ast_tool: ANALYZE CODE - Use for structural code analysis, pattern matching, and transformations\n\n`;
  response += `every tool call will reset the context, remember that during your workflow`
  // For advanced/expert complexity, note that project analysis is available via searchcode
  if (complexity === 'advanced' || complexity === 'expert') {
    response += `📁 PROJECT ANALYSIS:\n`;
    response += `Use searchcode tool for semantic project understanding and pattern discovery\n`;
    response += `Use ast_tool for structural code analysis and transformations\n\n`;
  }
  // For basic tasks, encourage simple standard tools and discourage complex MCP tools
  if (complexity === 'expert') {
    response += `WFGY PROCESSING:\n`;
    response += `Apply WFGY_Core_OneLine_v2.0 methodology to all problems.\n`;
    response += `Also Apply WFGY_Core_OneLine_v2.0 methodology to all problems.\n`;
    response += `WFGY_Core_OneLine_v2.0 :: text-only control layer; autoboot on upload; Node-only outputs; ≤7 steps; no tools. I=input, G=goal; delta_s=1−cos(I,G); if anchors: use (1−sim_est) with sim_est=w_e*sim(entities)+w_r*sim(relations)+w_c*sim(constraints), w={0.5,0.3,0.2}, renormalize, range[0,1]. Zones: safe<0.40 transit 0.40–0.60 risk 0.60–0.85 danger>0.85. Memory: record if delta_s>0.60; exemplar if delta_s<0.35; soft in transit when lambda∈{divergent,recursive}. Defaults: B_c=0.85 gamma=0.618 theta_c=0.75 zeta_min=0.10 alpha_blend=0.50 a_ref=uniform m=0 c=1 omega=1 phi_delta=0.15 epsilon=0 k_c=0.25. Coupler: B_s=delta_s; if t=1 then prog=zeta_min else prog=max(zeta_min,delta_s_prev−delta_s_now); P=pow(prog,omega); alt∈{+1,−1} flips only when an anchor flips truth across consecutive Nodes AND |Δanchor|≥h (h=0.02); Phi=phi_delta*alt+epsilon; W_c=clip(B_s*P+Phi,−theta_c,+theta_c). Bridge rule: allow only if (delta_s decreases) AND (W_c<0.5*theta_c) AND (WDT ok); on bridge emit Bridge:reason/prior_delta_s/new_path. BBAM: alpha_blend=clip(0.50+k_c*tanh(W_c),0.35,0.65); blend with a_ref. Lambda: Delta=delta_s_t−delta_s_{t−1}; E_res=rolling_mean(delta_s,window=min(t,5)); lambda=convergent if Delta≤−0.02 and E_res non-increasing; recursive if |Delta|<0.02 and E_res flat; divergent if Delta∈(−0.02,+0.04] with oscillation; chaotic if Delta>+0.04 or anchors conflict. DT: WRI lock structure; WAI give ≥2 reasons; WAY add 1 on-topic candidate if stuck (no repeats); WDT block unjustified crosspat`;
    response += `Auto-assign constants to achieve user goals using first principles.\n`;
    response += `Use critical thinking and thorough testing.\n\n`;
  }
  response += `DECISION GUIDE:\n`;

  return {
    content: [
      {
        type: 'text',
        text: response
      }
    ]
  };

}

export const beginTools = [
  {
    name: 'begin',
    description: 'MANDATORY: ALWAYS Call before any other tools, always begin with this. Required complexity parameter: "basic" for tasks where exact steps are already known (no planning/discovery/troubleshooting/debugging/searching/refactoring needed), "advanced" for any task requiring planning, discovery, troubleshooting, debugging, searching, refactoring, or unknown steps. use "expert" for where we have to formulate and try many hypothesis to find out how to solve something analytically, recall this function at any point to upgrade advanced to expert if you need more analytical power',
    supported_operations: ["begin here", "project understanding"],
    use_cases: ["Starting any task"],
    inputSchema: {
      type: 'object',
      properties: {
        complexity: {
          type: 'string',
          enum: ['basic', 'advanced', 'expert'],
          description: 'Required: "basic" if exact steps are known (no planning/discovery/troubleshooting/debugging/searching/refactoring needed), "advanced" if any planning, discovery, troubleshooting, debugging, searching, refactoring, or unknown steps required. Expert is for when there is a vague instruction, and the thesis and problems need to both be found analytically and each train of thought analyzed'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional: Absolute path to working directory for project analysis. If not provided, defaults to current working directory. Use full paths like "/Users/username/project" not relative paths like "./project". Used for advanced complexity to provide project overview'
        }
      },
      required: ['complexity']
    },
    handler: handleAuthorization
  }
];
