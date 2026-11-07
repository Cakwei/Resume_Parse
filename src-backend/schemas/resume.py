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
    matched_skills: List[str] = Field(default_factory=list, description="Skills present in resume that match target role")
    missing_skills: List[str] = Field(default_factory=list, description="Skills required or suggested that are missing")
    profile: Optional[CandidateProfile] = Field(None, description="Parsed candidate profile data")
