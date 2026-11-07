from typing import Optional, List
from pydantic import BaseModel, Field

class ContactInfo(BaseModel):
    name: Optional[str] = Field(None, description="Candidate full name")
    email: Optional[str] = Field(None, description="Candidate email address")
    phone: Optional[str] = Field(None, description="Candidate phone number")
    location: Optional[str] = Field(None, description="City, State, or Country")
    linkedin: Optional[str] = Field(None, description="LinkedIn profile URL or username")
    github: Optional[str] = Field(None, description="GitHub profile URL or username")
    website: Optional[str] = Field(None, description="Personal portfolio or website URL")

class WorkExperienceItem(BaseModel):
    title: str = Field(..., description="Job title")
    company: str = Field(..., description="Company name")
    location: Optional[str] = Field(None, description="Location of company")
    dates: Optional[str] = Field(None, description="Employment duration (e.g. 2021 - Present)")
    bullets: List[str] = Field(default_factory=list, description="Responsibilities and achievements")

class EducationItem(BaseModel):
    degree: str = Field(..., description="Degree or certificate name")
    institution: str = Field(..., description="College, University or Institution")
    dates: Optional[str] = Field(None, description="Graduation year or dates attended")
    location: Optional[str] = Field(None, description="Location of institution")
    gpa: Optional[str] = Field(None, description="GPA if specified")

class CandidateProfile(BaseModel):
    name: Optional[str] = Field(None, description="Candidate full name")
    email: Optional[str] = Field(None, description="Candidate email address")
    phone: Optional[str] = Field(None, description="Candidate phone number")
    summary: Optional[str] = Field(None, description="Professional summary or bio")
    skills: List[str] = Field(default_factory=list, description="Key technical and soft skills identified")
    experience: List[WorkExperienceItem] = Field(default_factory=list, description="List of work experience items")
    education: List[EducationItem] = Field(default_factory=list, description="List of education items")

class ATSScoreBreakdown(BaseModel):
    overall_score: int = Field(..., ge=0, le=100, description="Overall ATS compatibility score (0-100)")
    parseability: int = Field(..., ge=0, le=100, description="Structural and layout parseability score (0-100)")
    keyword_relevance: int = Field(..., ge=0, le=100, description="Keyword relevance and frequency score (0-100)")
    formatting_safety: int = Field(..., ge=0, le=100, description="Formatting safety against parser crashes (0-100)")
    metric_impact: int = Field(..., ge=0, le=100, description="Presence of measurable KPIs and action verbs (0-100)")
    role_match_score: Optional[int] = Field(None, ge=0, le=100, description="Job description match score (0-100) if JD provided")
    executive_rationale: str = Field(default="", description="Executive summary and ATS rationale explaining the overall score")
    structural_flaws: List[str] = Field(default_factory=list, description="Structural, layout, or formatting issues that could hinder ATS parsing")
    bullet_metrics_audit: List[str] = Field(default_factory=list, description="Critique of bullet points, weak verbs, and missing metrics")
    optimized_rewrites: List[str] = Field(default_factory=list, description="High-impact bullet rewrites adhering to Google X-Y-Z formula")
    matched_skills: List[str] = Field(default_factory=list, description="Skills present in resume that match target role")
    missing_skills: List[str] = Field(default_factory=list, description="Skills required or suggested that are missing")
    profile: Optional[CandidateProfile] = Field(None, description="Parsed candidate profile data")

    def to_markdown_audit(self) -> str:
        """
        Formats the structured ATS evaluation into a standardized GitHub Flavored Markdown report.
        Guarantees 100% synchronization between structured data and markdown text.
        """
        flaws_formatted = "\n".join([f"- {flaw}" for flaw in self.structural_flaws]) if self.structural_flaws else "- No critical structural formatting flaws detected. Standard ATS-compliant layout."
        bullet_audit_formatted = "\n".join([f"- {critique}" for critique in self.bullet_metrics_audit]) if self.bullet_metrics_audit else "- Bullet points meet standard action verb criteria."
        rewrites_formatted = "\n".join([f"- {rewrite}" for rewrite in self.optimized_rewrites]) if self.optimized_rewrites else "- Professional achievements adequately structured."

        jd_section = ""
        if self.role_match_score is not None:
            jd_section = f"- **Role Match Score**: {self.role_match_score}%\n"

        return f"""## 1. ATS Compliance Rating & Scorecard
- **Estimated Overall ATS Score**: {self.overall_score}%
- **Executive Rationale**: {self.executive_rationale or 'Evaluated based on standard technical recruiter guidelines and ATS parsing rules.'}
- **Parseability Rating**: {self.parseability}%
- **Keyword Relevance**: {self.keyword_relevance}%
- **Formatting Safety**: {self.formatting_safety}%
- **Metric Impact**: {self.metric_impact}%
{jd_section}
## 2. Structural & Formatting Flaws
{flaws_formatted}

## 3. Bullet Point & Metrics Audit
{bullet_audit_formatted}

## 4. Optimized Rewrites (Google X-Y-Z Formula)
{rewrites_formatted}
"""
