fix known inefficient problems

TODOS:
- context are managed independently by agents, need to have some kind of shared exec pipeline [x]
- need to have structured ACP (Agent Communication Protocol), current code pass res through loose coupling graph state
- create a shared exec context for the graph instead of reinit agents and contexts for each node
- if hash func is provided we don't have to fetch new data in caching mechanism 
- we can do paralellization on AgentGraph instead of sequential processing [x] (need more work)
- adjust BaseAgent to shared pipeline [x]