import pytest
from schemas.resume import CandidateProfile, ATSScoreBreakdown
from services.ai_evaluator import build_audit_prompt, build_schema_prompt

def test_audit_prompt_generation():
    prompt = build_audit_prompt("Sample Resume Text", "Target Senior Engineer role")
    assert "Target Senior Engineer role" in prompt
    assert "Google X-Y-Z" in prompt
    assert "Sample Resume Text" in prompt

def test_audit_prompt_truncation():
    huge_text = "Python Developer " * 5000  # ~85,000 chars
    prompt = build_audit_prompt(huge_text, None)
    assert len(prompt) < 40000
    assert "truncated" in prompt.lower()

def test_schema_model_validation():
    sample_data = {
        "overall_score": 85,
        "parseability": 90,
        "keyword_relevance": 80,
        "formatting_safety": 88,
        "metric_impact": 82,
        "role_match_score": 78,
        "matched_skills": ["Python", "FastAPI", "React"],
        "missing_skills": ["Kubernetes", "GraphQL"],
        "profile": {
            "name": "Jane Developer",
            "email": "jane@example.com",
            "phone": "+1 555-0199",
            "summary": "Full stack engineer with 5 years of experience",
            "skills": ["Python", "TypeScript", "FastAPI", "React"],
            "experience": [
                {
                    "title": "Software Engineer",
                    "company": "Tech Corp",
                    "dates": "2021 - Present",
                    "bullets": ["Increased throughput by 40% using async FastAPI."]
                }
            ],
            "education": [
                {
                    "degree": "B.S. in Computer Science",
                    "institution": "State University",
                    "dates": "2017 - 2021"
                }
            ]
        }
    }
    score = ATSScoreBreakdown.model_validate(sample_data)
    assert score.overall_score == 85
    assert score.role_match_score == 78
    assert len(score.matched_skills) == 3
    assert score.profile.name == "Jane Developer"
    assert len(score.profile.experience) == 1

def test_schema_to_markdown_audit_synchronization():
    sample_data = {
        "overall_score": 92,
        "parseability": 95,
        "keyword_relevance": 88,
        "formatting_safety": 94,
        "metric_impact": 90,
        "role_match_score": 89,
        "executive_rationale": "High-impact engineering profile with solid metrics.",
        "structural_flaws": ["Remove table wrappers around education."],
        "bullet_metrics_audit": ["Action verbs are strong across experience."],
        "optimized_rewrites": ["Increased backend throughput by 40% using async FastAPI."],
        "matched_skills": ["Python", "FastAPI"],
        "missing_skills": ["Docker"],
    }
    score = ATSScoreBreakdown.model_validate(sample_data)
    md = score.to_markdown_audit()
    assert "**Estimated Overall ATS Score**: 92%" in md
    assert "**Parseability Rating**: 95%" in md
    assert "**Role Match Score**: 89%" in md
    assert "Remove table wrappers around education." in md
    assert "Increased backend throughput by 40%" in md
