"""Enhanced pronunciation analysis service.

Uses both text similarity (SequenceMatcher) and phonetic matching
(Double Metaphone) to produce a blended pronunciation score with
detailed, per-word feedback.
"""

from difflib import SequenceMatcher
from typing import Any

try:
    from metaphone import doublemetaphone
    HAS_METAPHONE = True
except ImportError:
    HAS_METAPHONE = False


class PronunciationAnalyzer:
    """Analyzer that compares expected vs. spoken text using text + phonetic similarity."""

    # Score weights
    TEXT_WEIGHT = 0.6
    PHONETIC_WEIGHT = 0.4

    @staticmethod
    def _normalize(text: str) -> str:
        """Lowercase, strip, collapse whitespace."""
        return " ".join(text.lower().strip().split())

    @staticmethod
    def _similarity(a: str, b: str) -> float:
        """Return 0-1 ratio of similarity."""
        return SequenceMatcher(None, a, b).ratio()

    @staticmethod
    def _phonetic_similarity(a: str, b: str) -> float:
        """Compare two words using Double Metaphone codes."""
        if not HAS_METAPHONE:
            return PronunciationAnalyzer._similarity(a, b)

        codes_a = doublemetaphone(a)
        codes_b = doublemetaphone(b)

        # Try all combinations and take the best match
        best = 0.0
        for ca in codes_a:
            if not ca:
                continue
            for cb in codes_b:
                if not cb:
                    continue
                sim = SequenceMatcher(None, ca, cb).ratio()
                best = max(best, sim)
        return best

    def _word_level_analysis(
        self, expected_words: list[str], spoken_words: list[str]
    ) -> list[dict[str, Any]]:
        """Produce per-word comparison with text + phonetic match."""
        results: list[dict[str, Any]] = []
        max_len = max(len(expected_words), len(spoken_words))

        for i in range(max_len):
            exp = expected_words[i] if i < len(expected_words) else None
            spk = spoken_words[i] if i < len(spoken_words) else None

            entry: dict[str, Any] = {
                "expected": exp or "(missing)",
                "heard": spk or "(missing)",
            }

            if exp and spk:
                entry["text_match"] = exp == spk
                entry["text_similarity"] = round(self._similarity(exp, spk), 3)
                entry["phonetic_similarity"] = round(self._phonetic_similarity(exp, spk), 3)
                # Word is "close enough" phonetically even if text doesn't match
                entry["phonetically_close"] = entry["phonetic_similarity"] >= 0.7
            else:
                entry["text_match"] = False
                entry["text_similarity"] = 0.0
                entry["phonetic_similarity"] = 0.0
                entry["phonetically_close"] = False

            results.append(entry)
        return results

    def analyze(
        self,
        expected: str,
        transcription: str,
        confidence: float = 1.0,
    ) -> dict[str, Any]:
        """Return pronunciation score + feedback dict."""
        norm_expected = self._normalize(expected)
        norm_transcription = self._normalize(transcription)

        # ── Text similarity ───────────────────────────────
        text_sim = self._similarity(norm_expected, norm_transcription)

        # ── Phonetic similarity (word-level average) ──────
        expected_words = norm_expected.split()
        spoken_words = norm_transcription.split()

        word_analysis = self._word_level_analysis(expected_words, spoken_words)

        # Average phonetic similarity
        phonetic_scores = [w["phonetic_similarity"] for w in word_analysis]
        phonetic_sim = sum(phonetic_scores) / len(phonetic_scores) if phonetic_scores else 0.0

        # ── Blended score ─────────────────────────────────
        blended_sim = (text_sim * self.TEXT_WEIGHT) + (phonetic_sim * self.PHONETIC_WEIGHT)
        raw_score = blended_sim * 100
        pronunciation_score = round(raw_score * min(confidence, 1.0), 1)

        # ── Feedback ──────────────────────────────────────
        feedback: dict[str, Any] = {
            "overall": self._overall_comment(pronunciation_score),
            "similarity_ratio": round(text_sim, 3),
            "phonetic_ratio": round(phonetic_sim, 3),
            "tips": [],
        }

        if norm_expected == norm_transcription:
            feedback["match"] = True
            feedback["tips"].append("Perfect match! Keep it up! 🎉")
        else:
            feedback["match"] = False

            # Word differences (only truly wrong ones)
            wrong: list[dict[str, str]] = []
            phonetically_close: list[str] = []

            for w in word_analysis:
                if not w["text_match"] and w["expected"] != "(missing)" and w["heard"] != "(missing)":
                    if w["phonetically_close"]:
                        phonetically_close.append(w["expected"])
                    else:
                        wrong.append({"expected": w["expected"], "heard": w["heard"]})

            feedback["word_differences"] = wrong
            feedback["word_analysis"] = word_analysis

            if wrong:
                feedback["tips"].append(
                    f"Focus on these words: {', '.join(w['expected'] for w in wrong)}"
                )
            if phonetically_close:
                feedback["tips"].append(
                    f"Almost there! These sound close but could be clearer: {', '.join(phonetically_close)}"
                )
            if len(spoken_words) < len(expected_words):
                feedback["tips"].append("Try to pronounce all words in the phrase.")
            if len(spoken_words) > len(expected_words):
                feedback["tips"].append("You added extra words – try to match the phrase exactly.")

            # Phonetic tip
            if phonetic_sim > text_sim + 0.1:
                feedback["tips"].append(
                    "Your pronunciation sounds close! The issue might be accent or emphasis. 🎯"
                )

        return {
            "pronunciation_score": pronunciation_score,
            "confidence_score": round(confidence * 100, 1),
            "feedback": feedback,
        }

    @staticmethod
    def _overall_comment(score: float) -> str:
        if score >= 95:
            return "Excellent! 🌟"
        if score >= 80:
            return "Great job! 👏"
        if score >= 60:
            return "Good attempt – keep practicing! 💪"
        if score >= 40:
            return "Needs improvement – listen carefully and try again. 🔄"
        return "Let's try once more – focus on each syllable. 🎯"
