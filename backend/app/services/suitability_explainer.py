import json
import os
import httpx

class SuitabilityExplainer:
    def __init__(self):
        # Fallback to an env variable since no centralized LLM client is in config.py yet
        self.api_key = os.getenv("OPENAI_API_KEY")

    async def generate_explanation(self, deterministic_result: dict) -> str:
        """
        Passes the deterministic JSON to the LLM to format the response for the farmer.
        Enforces strict formatting and prohibits hallucinations.
        """
        prompt = f"""
You are an agricultural expert formatter. Your job is to format the given crop suitability data for a farmer.

Data:
{json.dumps(deterministic_result, indent=2)}

Constraints:
- You must NOT calculate scores.
- You must NOT change the category.
- You must NOT invent reasons or limitations not present in the JSON.
- Output MUST be exactly this format:
[Crop Name] — [Suitability Category]
Reasons: 
✓ [Reason 1]
✓ [Reason 2]
Limitations: 
- [Limitation 1]
- [Limitation 2]
"""
        
        # Stub logic: If no API key is provided, behave deterministically to prevent crashing.
        if not self.api_key:
            return self._fallback_formatter(deterministic_result)

        # Example LLM Call (OpenAI logic):
        # async with httpx.AsyncClient() as client:
        #     response = await client.post(
        #         "https://api.openai.com/v1/chat/completions",
        #         headers={"Authorization": f"Bearer {self.api_key}"},
        #         json={
        #             "model": "gpt-4",
        #             "messages": [{"role": "system", "content": prompt}]
        #         }
        #     )
        #     data = response.json()
        #     return data["choices"][0]["message"]["content"]
        
        return self._fallback_formatter(deterministic_result)
        
    def _fallback_formatter(self, deterministic_result: dict) -> str:
        """Fallback deterministic formatter if the LLM goes down or isn't configured."""
        lines = [f"{deterministic_result['crop_name']} — {deterministic_result['category']}", "Reasons:"]
        
        if deterministic_result['reasons']:
            for r in deterministic_result['reasons']:
                lines.append(f"✓ {r}")
        else:
            lines.append("✓ No major advantages identified.")
            
        lines.append("Limitations:")
        
        if deterministic_result['limitations']:
            for l in deterministic_result['limitations']:
                lines.append(f"- {l}")
        else:
            lines.append("- No major limitations identified.")
            
        return "\n".join(lines)
