from google.adk.agents.llm_agent import Agent
from google.adk.tools import google_search

root_agent = Agent(
    name="researcher",
    model="gemini-flash-latest",
    instruction="You help users research topics thoroughly.",
    tools=[google_search],
)
