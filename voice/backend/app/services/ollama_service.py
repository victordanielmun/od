"""Ollama AI service — generates learning feedback using gemma2:2b."""

import httpx
from app.core.config import get_settings

settings = get_settings()


async def generate_feedback(
    question: str,
    correct_answer: str,
    user_answer: str,
    is_correct: bool,
    explanation_es: str,
) -> str:
    """
    Call Ollama gemma2:2b to generate personalized feedback for a challenge attempt.
    Returns a short motivational/explanatory message in Spanish.
    """
    if is_correct:
        prompt = (
            f"El usuario respondió correctamente la siguiente pregunta de inglés.\n"
            f"Pregunta: {question}\n"
            f"Respuesta correcta: {correct_answer}\n"
            f"Explicación: {explanation_es}\n\n"
            f"Escribe un mensaje corto de felicitación (2-3 oraciones) en español, "
            f"motivando al usuario y reforzando el concepto aprendido."
        )
    else:
        prompt = (
            f"El usuario respondió incorrectamente la siguiente pregunta de inglés.\n"
            f"Pregunta: {question}\n"
            f"El usuario respondió: {user_answer}\n"
            f"La respuesta correcta es: {correct_answer}\n"
            f"Explicación: {explanation_es}\n\n"
            f"Escribe un mensaje corto de ánimo (2-3 oraciones) en español, "
            f"explicando por qué la respuesta correcta es la correcta, de forma amigable."
        )

    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "").strip()
    except Exception as e:
        # Graceful fallback — don't fail the whole request if Ollama is offline
        return explanation_es or f"Respuesta {'correcta' if is_correct else 'incorrecta'}."
