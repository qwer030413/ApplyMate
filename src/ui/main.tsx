import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Globe,
  HardDrive,
  KeyRound,
  Link,
  ListChecks,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  emptyProfile,
  newEducation,
  newEmployment,
  parseBackup,
  readiness,
  validateProfile,
  type ApplicantProfile,
} from "../shared/profile";
import { profileStore } from "../shared/storage";
import { resumeStore, validateResumeFile, type SavedResume } from '../shared/resume-file';
import {
  mergeResume,
  readResume,
  type ResumeImportDraft,
} from "../shared/resume";
import type { ApplicationRun, PageScan } from "../shared/types";
import "./style.css";

type Icon = typeof UserRound;
const sections: { id: string; label: string; icon: Icon }[] = [
  { id: "personal", label: "Personal details", icon: UserRound },
  { id: "employment", label: "Experience", icon: BriefcaseBusiness },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "skills", label: "Skills & answers", icon: ListChecks },
  { id: "settings", label: "Data & settings", icon: Settings2 },
];
const personalLabels: Record<keyof ApplicantProfile["personal"], string> = {
  firstName: "First name",
  lastName: "Last name",
  preferredName: "Preferred name",
  email: "Email address",
  phone: "Phone number",
  address: "Street address",
  city: "City",
  state: "State / province",
  postalCode: "Postal code",
  country: "Country",
  linkedin: "LinkedIn URL",
  website: "Website / portfolio URL",
};
function Brand() {
  return (
    <div className="brand">
      <img
        src="/icon48.png"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span>
        Apply<span className="brand-accent">Mate</span>
      </span>
    </div>
  );
}
function IconButton({
  title,
  children,
  onClick,
  disabled = false,
}: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
function MoveButtons({
  index,
  length,
  onMove,
  onDelete,
}: {
  index: number;
  length: number;
  onMove: (direction: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="row-actions">
      <IconButton
        title="Move up"
        onClick={() => onMove(-1)}
        disabled={index === 0}
      >
        <ArrowUp size={16} />
      </IconButton>
      <IconButton
        title="Move down"
        onClick={() => onMove(1)}
        disabled={index === length - 1}
      >
        <ArrowDown size={16} />
      </IconButton>
      <IconButton title="Remove entry" onClick={onDelete}>
        <Trash2 size={16} />
      </IconButton>
    </div>
  );
}
function download(profile: ApplicantProfile) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "applymate-profile.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ProfileApp() {
  const [profile, setProfile] = useState<ApplicantProfile>(emptyProfile);
  const [section, setSection] = useState("personal");
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ResumeImportDraft | null>(null);
  const [replace, setReplace] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [savedResume,setSavedResume]=useState<SavedResume|null>(null);
  const [pendingResume,setPendingResume]=useState<File|null>(null);
  const [updateFromResume,setUpdateFromResume]=useState(false);
  const [confirmRemoveResume,setConfirmRemoveResume]=useState(false);
  const [backup, setBackup] = useState<ApplicantProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const resumeRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  useEffect(()=>{void resumeStore.get().then(setSavedResume).catch(e=>setError(e.message));},[]);
  useEffect(() => {
    void profileStore
      .get()
      .then((p) => {
        setProfile(p);
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
      });
  }, []);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  function update(next: ApplicantProfile) {
    setProfile(next);
    setDirty(true);
    setNotice("");
  }
  async function save() {
    const errors = validateProfile(profile);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setSaving(true);
    try {
      await profileStore.set(profile);
      setDirty(false);
      setNotice("Profile saved on this device.");
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }
  async function importResume(file?: File) {
    if (!file) return;
    setParsing(true);
    setError("");
    try {
      setDraft(await readResume(file));
      setReplace(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read this resume. You can enter your information manually.",
      );
    } finally {
      setParsing(false);
    }
  }
  async function chooseResume(file?:File){
    if(!file)return;
    try{await validateResumeFile(file);setPendingResume(file);setUpdateFromResume(false);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not read the file.');}
  }
  async function saveResume(){
    if(!pendingResume)return;
    const file=pendingResume;setParsing(true);setError('');
    try{const saved=await resumeStore.set(file);setSavedResume(saved);setPendingResume(null);setNotice('Resume saved for application uploads. Your profile is unchanged.');if(updateFromResume)await importResume(file);}
    catch(e){setError(e instanceof Error?e.message:'Could not save your resume.');}
    finally{setParsing(false);}
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 2 MB.");
      setBackup(parseBackup(JSON.parse(await file.text())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid backup.");
    }
  }
  function reorder(
    collection: "employment" | "education" | "savedAnswers",
    index: number,
    direction: number,
  ) {
    const rows = [...profile[collection]];
    [rows[index], rows[index + direction]] = [
      rows[index + direction],
      rows[index],
    ];
    update({ ...profile, [collection]: rows });
  }
  const ready = readiness(profile);
  const active = sections.find((s) => s.id === section)!;
  const aiModeChoices: {
    key: "workAuthorization" | "salaryExpectations" | "sensitiveQuestions";
    label: string;
    help: string;
  }[] = [
    {
      key: "workAuthorization",
      label: "Work authorization",
      help: "Allow AI Mode to draft answers about authorization and sponsorship.",
    },
    {
      key: "salaryExpectations",
      label: "Salary expectations",
      help: "Allow AI Mode to draft compensation-related answers.",
    },
    {
      key: "sensitiveQuestions",
      label: "Sensitive questions",
      help: "Allow AI Mode to draft answers for demographic or personal questions.",
    },
  ];




  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {sections.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setSection(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {section === item.id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-label">
            <ShieldCheck size={18} /> Stored on your device
          </div>
          <small>ApplyMate / Early access</small>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <span>
            Your profile <ChevronRight size={14} /> <b>{active.label}</b>
          </span>
          <div className="save-area">
            <span className={dirty ? "save-state unsaved" : "save-state"}>
              {dirty ? (
                "Unsaved changes"
              ) : (
                <>
                  <Check size={14} /> Saved locally
                </>
              )}
            </span>
            <button
              className="primary"
              disabled={!loaded || saving}
              onClick={() => void save()}
            >
              {saving ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Save size={16} />
              )}
              Save profile
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">MY PROFILE</div>
              <h1>{active.label}</h1>
            </div>
            <button
              className="secondary"
              onClick={() => resumeRef.current?.click()}
              disabled={parsing || !loaded}
            >
              {parsing ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Upload size={17} />
              )}
              {savedResume?'Replace resume':'Upload resume'}
            </button>
          </div>
          <input
            hidden
            ref={resumeRef}
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => {
              void chooseResume(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            hidden
            ref={backupRef}
            type="file"
            accept=".json"
            onChange={(e) => {
              void importBackup(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {notice && (
            <div className="notice success" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
              <IconButton title="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          {savedResume&&<section className="saved-resume" aria-label="Saved resume"><FileText size={22}/><div className="resume-details"><b>{savedResume.name}</b><span>{Math.max(1,Math.round(savedResume.size/1024))} KB · Saved for application uploads</span></div><button className="text-button" disabled={parsing} onClick={()=>void importResume(new File([savedResume.blob],savedResume.name,{type:savedResume.type}))}>Update profile</button><IconButton title="Remove saved resume" onClick={()=>setConfirmRemoveResume(true)}><Trash2 size={17}/></IconButton></section>}
          <div className="profile-layout">
            <div className="editor">
              {section === "personal" && (
                <>
                  <section className="editor-section">
                    <div className="section-heading">
                      <UserRound size={19} />
                      <h2>Contact information</h2>
                    </div>
                    <div className="form-grid">
                      {(
                        [
                          "firstName",
                          "lastName",
                          "preferredName",
                          "email",
                          "phone",
                        ] as const
                      ).map((key) => (
                        <Field
                          key={key}
                          label={personalLabels[key]}
                          value={profile.personal[key]}
                          type={
                            key === "email"
                              ? "email"
                              : key === "phone"
                                ? "tel"
                                : "text"
                          }
                          onChange={(value) =>
                            update({
                              ...profile,
                              personal: { ...profile.personal, [key]: value },
                            })
                          }
                        />
                      ))}
                    </div>
                  </section>
                  <section className="editor-section">
                    <div className="section-heading">
                      <Globe size={19} />
                      <h2>Location</h2>
                    </div>
                    <div className="form-grid">
                      {(
                        [
                          "address",
                          "city",
                          "state",
                          "postalCode",
                          "country",
                        ] as const
                      ).map((key) => (
                        <Field
                          key={key}
                          wide={key === "address"}
                          label={personalLabels[key]}
                          value={profile.personal[key]}
                          onChange={(value) =>
                            update({
                              ...profile,
                              personal: { ...profile.personal, [key]: value },
                            })
                          }
                        />
                      ))}
                    </div>
                  </section>
                  <section className="editor-section">
                    <div className="section-heading">
                      <Link size={19} />
                      <h2>Links</h2>
                    </div>
                    <div className="form-grid">
                      {(["linkedin", "website"] as const).map((key) => (
                        <Field
                          key={key}
                          label={personalLabels[key]}
                          value={profile.personal[key]}
                          type="url"
                          onChange={(value) =>
                            update({
                              ...profile,
                              personal: { ...profile.personal, [key]: value },
                            })
                          }
                        />
                      ))}
                    </div>
                  </section>
                </>
              )}
              {section === "employment" && (
                <>
                  <div className="list-heading">
                    <h2>Employment history</h2>
                    <button
                      className="secondary"
                      onClick={() =>
                        update({
                          ...profile,
                          employment: [...profile.employment, newEmployment()],
                        })
                      }
                    >
                      <Plus size={17} />
                      Add experience
                    </button>
                  </div>
                  {profile.employment.length === 0 && (
                    <Empty
                      icon={BriefcaseBusiness}
                      text="No experience added"
                    />
                  )}
                  {profile.employment.map((row, index) => (
                    <section className="entry" key={row.id}>
                      <div className="entry-heading">
                        <div>
                          <span className="entry-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3>{row.company || "New experience"}</h3>
                        </div>
                        <MoveButtons
                          index={index}
                          length={profile.employment.length}
                          onMove={(direction) =>
                            reorder("employment", index, direction)
                          }
                          onDelete={() =>
                            update({
                              ...profile,
                              employment: profile.employment.filter(
                                (r) => r.id !== row.id,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="form-grid">
                        {(
                          [
                            "company",
                            "title",
                            "location",
                            "startDate",
                            "endDate",
                            "description",
                          ] as const
                        )
                          .filter((key) => key !== "endDate" || !row.current)
                          .map((key) => (
                            <Field
                              key={key}
                              label={
                                {
                                  company: "Company",
                                  title: "Job title",
                                  location: "Location",
                                  startDate: "Start date",
                                  endDate: "End date",
                                  description: "Responsibilities",
                                }[key]
                              }
                              value={row[key]}
                              type={
                                key.includes("Date")
                                  ? "month"
                                  : key === "description"
                                    ? "textarea"
                                    : "text"
                              }
                              wide={key === "description"}
                              onChange={(value) =>
                                update({
                                  ...profile,
                                  employment: profile.employment.map((r) =>
                                    r.id === row.id
                                      ? { ...r, [key]: value }
                                      : r,
                                  ),
                                })
                              }
                            />
                          ))}
                      </div>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={row.current}
                          onChange={(e) =>
                            update({
                              ...profile,
                              employment: profile.employment.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      current: e.target.checked,
                                      endDate: e.target.checked
                                        ? ""
                                        : r.endDate,
                                    }
                                  : r,
                              ),
                            })
                          }
                        />
                        I currently work here
                      </label>
                    </section>
                  ))}
                </>
              )}
              {section === "education" && (
                <>
                  <div className="list-heading">
                    <h2>Education history</h2>
                    <button
                      className="secondary"
                      onClick={() =>
                        update({
                          ...profile,
                          education: [...profile.education, newEducation()],
                        })
                      }
                    >
                      <Plus size={17} />
                      Add education
                    </button>
                  </div>
                  {!profile.education.length && (
                    <Empty icon={GraduationCap} text="No education added" />
                  )}
                  {profile.education.map((row, index) => (
                    <section className="entry" key={row.id}>
                      <div className="entry-heading">
                        <div>
                          <span className="entry-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3>{row.school || "New education"}</h3>
                        </div>
                        <MoveButtons
                          index={index}
                          length={profile.education.length}
                          onMove={(direction) =>
                            reorder("education", index, direction)
                          }
                          onDelete={() =>
                            update({
                              ...profile,
                              education: profile.education.filter(
                                (r) => r.id !== row.id,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="form-grid">
                        {(
                          [
                            "school",
                            "degree",
                            "field",
                            "gpa",
                            "startDate",
                            "endDate",
                          ] as const
                        ).map((key) => (
                          <Field
                            key={key}
                            label={
                              {
                                school: "School / university",
                                degree: "Degree",
                                field: "Field of study",
                                gpa: "GPA",
                                startDate: "Start date",
                                endDate: "End date",
                              }[key]
                            }
                            value={row[key]}
                            type={key.includes("Date") ? "month" : "text"}
                            onChange={(value) =>
                              update({
                                ...profile,
                                education: profile.education.map((r) =>
                                  r.id === row.id ? { ...r, [key]: value } : r,
                                ),
                              })
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
              {section === "skills" && (
                <>
                  <section className="editor-section">
                    <h2>Skills</h2>
                    <Field
                      label="Your skills"
                      value={profile.skills}
                      type="textarea"
                      onChange={(skills) => update({ ...profile, skills })}
                    />
                  </section>
                  <section className="editor-section">
                    <h2>US work eligibility</h2>
                    <div className="form-grid">
                      {(["authorizedUS", "sponsorship"] as const).map((key) => (
                        <label className="field" key={key}>
                          <span>
                            {key === "authorizedUS"
                              ? "Authorized to work lawfully in the United States?"
                              : "Will you now or in the future require sponsorship?"}
                          </span>
                          <select
                            value={profile.answers[key]}
                            onChange={(e) =>
                              update({
                                ...profile,
                                answers: {
                                  ...profile.answers,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="">Not answered</option>
                            <option>Yes</option>
                            <option>No</option>
                          </select>
                        </label>
                      ))}
                    </div>
                  </section>
                  <section className="editor-section">
                    <h2>Application source</h2>
                    <Field
                      label="How did you hear about this job?"
                      value={profile.answers.heardAbout}
                      onChange={(heardAbout) =>
                        update({
                          ...profile,
                          answers: { ...profile.answers, heardAbout },
                        })
                      }
                    />
                  </section>
                  <section className="editor-section">
                    <h2>Voluntary self-identification</h2>
                    <div className="form-grid">
                      {(
                        [
                          ["gender", "Gender"],
                          ["hispanicLatino", "Hispanic / Latino"],
                          ["veteranStatus", "Veteran status"],
                          ["disabilityStatus", "Disability status"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field
                          key={key}
                          label={label}
                          value={profile.answers[key]}
                          onChange={(value) =>
                            update({
                              ...profile,
                              answers: {
                                ...profile.answers,
                                [key]: value,
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </section>
                  <section className="editor-section">
                    <div className="list-heading">
                      <h2>Saved answers</h2>
                      <button
                        className="secondary"
                        onClick={() =>
                          update({
                            ...profile,
                            savedAnswers: [
                              ...profile.savedAnswers,
                              {
                                id: crypto.randomUUID(),
                                question: "",
                                answer: "",
                              },
                            ],
                          })
                        }
                      >
                        <Plus size={16} />
                        Add answer
                      </button>
                    </div>
                    {!profile.savedAnswers.length && (
                      <Empty icon={ListChecks} text="No saved answers" />
                    )}
                    {profile.savedAnswers.map((row) => (
                      <div className="answer-row" key={row.id}>
                        <Field
                          label="Application question"
                          value={row.question}
                          onChange={(question) =>
                            update({
                              ...profile,
                              savedAnswers: profile.savedAnswers.map((r) =>
                                r.id === row.id ? { ...r, question } : r,
                              ),
                            })
                          }
                        />
                        <Field
                          label="Your answer"
                          type="textarea"
                          value={row.answer}
                          onChange={(answer) =>
                            update({
                              ...profile,
                              savedAnswers: profile.savedAnswers.map((r) =>
                                r.id === row.id ? { ...r, answer } : r,
                              ),
                            })
                          }
                        />
                        <button
                          className="text-button danger"
                          onClick={() =>
                            update({
                              ...profile,
                              savedAnswers: profile.savedAnswers.filter(
                                (r) => r.id !== row.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                          Remove answer
                        </button>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {section === "settings" && (
                <>
                  <section className="editor-section">
                    <div className="section-heading">
                      <HardDrive size={19} />
                      <h2>Profile backup</h2>
                    </div>
                    <p className="muted">
                      Your profile stays on this device. Removing ApplyMate may
                      erase it. Keep a backup somewhere private.
                    </p>
                    <div className="button-row">
                      <button
                        className="secondary"
                        onClick={() => download(profile)}
                      >
                        <Download size={16} />
                        Export backup
                      </button>
                      <button
                        className="secondary"
                        onClick={() => backupRef.current?.click()}
                      >
                        <Upload size={16} />
                        Import backup
                      </button>
                    </div>
                  </section>
                  <section className="editor-section">
                    <div className="section-heading">
                      <Settings2 size={19} />
                      <h2>AI mode</h2>
                    </div>
                    <p className="muted">
                      Use AI to draft answers for application fields that need
                      more context than your saved profile.
                    </p>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={profile.aiMode.enabled}
                        onChange={(event) =>
                          update({
                            ...profile,
                            aiMode: {
                              ...profile.aiMode,
                              enabled: event.target.checked,
                            },
                          })
                        }
                      />
                      Enable AI Mode
                    </label>
                    <div className="form-grid">
                      <label className="field wide">
                        <span>API key</span>
                        <input
                          type="password"
                          autoComplete="off"
                          placeholder="sk-..."
                          value={profile.aiMode.APIkey}
                          onChange={(event) =>
                            update({
                              ...profile,
                              aiMode: {
                                ...profile.aiMode,
                                APIkey: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="answer-row">
                      <div className="section-heading">
                        <KeyRound size={18} />
                        <h2>Allowed AI answer types</h2>
                      </div>
                      {aiModeChoices.map((choice) => (
                        <label className="check-label" key={choice.key}>
                          <input
                            type="checkbox"
                            checked={profile.aiMode[choice.key]}
                            disabled={!profile.aiMode.enabled}
                            onChange={(event) =>
                              update({
                                ...profile,
                                aiMode: {
                                  ...profile.aiMode,
                                  [choice.key]: event.target.checked,
                                },
                              })
                            }
                          />
                          <span>
                            {choice.label}
                            <br />
                            <small className="muted">{choice.help}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                  <section className="editor-section">
                    <h2>Privacy</h2>
                    <p className="muted">
                      No account. No analytics. Resume processing happens on
                      this device. Information you fill into an application is
                      shared with that site.
                    </p>
                    <p className="muted">
                      Local storage and exported backups are not encrypted by
                      ApplyMate. Your saved resume stays on this device and is shared with application sites when attached. Profile backups do not include the resume file.
                    </p>
                  </section>
                  <section className="editor-section">
                    <h2>Delete profile</h2>
                    <p className="muted">
                      Permanently remove all saved ApplyMate information from
                      this browser.
                    </p>
                    <button
                      className="secondary danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={16} />
                      Delete all data
                    </button>
                  </section>
                </>
              )}
            </div>
            <aside className="profile-summary">
              <div className="summary-heading">
                <span className="avatar">
                  {profile.personal.firstName?.[0] || "A"}
                  {profile.personal.lastName?.[0] || "M"}
                </span>
                <h3>
                  {[profile.personal.firstName, profile.personal.lastName]
                    .filter(Boolean)
                    .join(" ") || "Your next chapter"}
                </h3>
                <span className="muted">
                  {profile.personal.email || "Your application profile"}
                </span>
              </div>
              <div className="completion">
                <div>
                  <b>Contact readiness</b>
                  <span>
                    {ready.complete}/{ready.total}
                  </span>
                </div>
                <progress max={ready.total} value={ready.complete} />
              </div>
              <div className="summary-lines">
                <span>
                  <BriefcaseBusiness size={16} />
                  Experience<b>{profile.employment.length}</b>
                </span>
                <span>
                  <GraduationCap size={16} />
                  Education<b>{profile.education.length}</b>
                </span>
                <span>
                  <ListChecks size={16} />
                  Saved answers<b>{profile.savedAnswers.length}</b>
                </span>
              </div>
              <div className="local-note">
                <ShieldCheck size={18} />
                <span>
                  Private by default
                  <br />
                  <small>Only saved on this device</small>
                </span>
              </div>
            </aside>
          </div>
          <footer>
            <span>ApplyMate</span>
            <span>Your next role starts with you.</span>
          </footer>
        </div>
      </main>
      {pendingResume&&<div className="modal-backdrop"><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="save-resume-title"><h2 id="save-resume-title">{savedResume?'Replace saved resume':'Save resume'}</h2><p className="resume-filename">{pendingResume.name}</p><p className="muted">This file will be attached to supported resume fields when you use autofill.</p><label className="check-label"><input type="checkbox" checked={updateFromResume} onChange={e=>setUpdateFromResume(e.target.checked)} disabled={parsing}/>Also update my profile from this resume</label><p className="muted small">Profile changes are reviewed separately before merging.</p>{error&&<p role="alert" className="danger">{error}</p>}<div className="modal-actions"><button className="secondary" disabled={parsing} onClick={()=>setPendingResume(null)}>Cancel</button><button className="primary" disabled={parsing} onClick={()=>void saveResume()}>{parsing?<LoaderCircle size={16} className="spin"/>:<Save size={16}/>}Save resume</button></div></section></div>}
      {confirmRemoveResume&&<Confirm title="Remove saved resume?" text="Your profile will stay unchanged. Applications will no longer receive this file from ApplyMate." action="Remove resume" onCancel={()=>setConfirmRemoveResume(false)} onConfirm={()=>{void resumeStore.clear().then(()=>{setSavedResume(null);setConfirmRemoveResume(false);setNotice('Saved resume removed. Your profile is unchanged.');}).catch(e=>setError(e.message));}}/>}
      {draft && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <div className="modal-title">
              <h2 id="import-title">Review resume import</h2>
              <IconButton title="Cancel import" onClick={() => setDraft(null)}>
                <X size={20} />
              </IconButton>
            </div>
            <p className="muted">{draft.warnings[0]}</p>
            <div className="form-grid">
              {Object.entries(draft.personal).map(([key, value]) => (
                <Field
                  key={key}
                  label={personalLabels[key as keyof typeof personalLabels]}
                  value={value || ""}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      personal: { ...draft.personal, [key]: value },
                    })
                  }
                />
              ))}
            </div>
            <Field
              label="Skills"
              value={draft.skills || ""}
              type="textarea"
              onChange={(skills) => setDraft({ ...draft, skills })}
            />
            {(["employment", "education"] as const).map((kind) => (
              <div key={kind}>
                <h3>
                  {kind === "employment" ? "Experience" : "Education"}{" "}
                  suggestions
                </h3>
                {draft[kind].map((row, index) => (
                  <div className="draft-entry" key={row.id}>
                    {Object.entries(row)
                      .filter(([key]) => key !== "id" && key !== "current")
                      .map(([key, value]) => (
                        <Field
                          key={key}
                          label={key.replace(/([A-Z])/g, " $1")}
                          value={String(value)}
                          onChange={(value) =>
                            setDraft({
                              ...draft,
                              [kind]: draft[kind].map((r, i) =>
                                i === index ? { ...r, [key]: value } : r,
                              ),
                            })
                          }
                        />
                      ))}
                    <button
                      className="text-button danger"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          [kind]: draft[kind].filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove suggestion
                    </button>
                  </div>
                ))}
                {!draft[kind].length && (
                  <p className="muted">No entries detected.</p>
                )}
              </div>
            ))}
            <label className="check-label">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              Replace existing information where suggestions are present
            </label>
            <p className="muted small">
              By default, only empty fields and empty history sections are
              filled. Review and save your profile after merging.
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  update(mergeResume(profile, draft, replace));
                  setDraft(null);
                  setNotice(
                    "Suggestions merged. Review your profile, then save.",
                  );
                }}
              >
                <Check size={16} />
                Merge into profile
              </button>
            </div>
          </section>
        </div>
      )}
      {backup && (
        <Confirm
          title="Replace your profile?"
          text="This backup will replace the current profile, including unsaved edits."
          action="Restore backup"
          onCancel={() => setBackup(null)}
          onConfirm={() => {
            update(backup);
            setBackup(null);
            setNotice("Backup loaded. Save your profile to keep it.");
          }}
        />
      )}
      {confirmDelete && (
        <Confirm
          title="Delete all ApplyMate data?"
          text="This cannot be undone. Export a backup first if you need to keep your profile."
          action="Delete all data"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void profileStore
              .clear()
              .then(() => {
                setProfile(emptyProfile());
                setSavedResume(null);
                setDirty(false);
                setConfirmDelete(false);
                setNotice("All saved data deleted.");
              })
              .catch((e) => setError(e.message));
          }}
        />
      )}
    </div>
  );
}
function Empty({ icon: Icon, text }: { icon: Icon; text: string }) {
  return (
    <div className="empty">
      <Icon size={30} />
      <span>{text}</span>
    </div>
  );
}
function Confirm({
  title,
  text,
  action,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  action: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal compact"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary" onClick={onConfirm}>
            {action}
          </button>
        </div>
      </section>
    </div>
  );
}

type Snapshot = ApplicationRun & { scan: PageScan; busy: boolean };
async function request(message: Record<string, unknown>) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
}
function PanelApp() {
  const [tabId, setTabId] = useState<number>();
  const [frameId, setFrameId] = useState(0);
  const [frames, setFrames] = useState<{ frameId: number }[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [connecting, setConnecting] = useState(false);
  const [origins, setOrigins] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function connect() {
    setConnecting(true);
    setError("");
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id || !tab.url?.match(/^https?:/))
        throw new Error(
          "Open a job application in a regular web tab, then click the ApplyMate extension icon.",
        );
      setTabId(tab.id);
      const found = await request({ type: "CONNECT", tabId: tab.id });
      setFrames(found);
      setFrameId(found[0]?.frameId || 0);
      setOrigins(await request({ type: "FRAME_ORIGINS", tabId: tab.id }));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Click the ApplyMate extension icon on your application tab.",
      );
    } finally {
      setConnecting(false);
    }
  }
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      setError(
        "This panel connects to applications when opened from the installed Chrome extension.",
      );
      return;
    }
    void connect();
    void profileStore.get().then(setProfile);
    const changed = () => {
      void profileStore.get().then(setProfile);
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, []);
  useEffect(() => {
    if (tabId === undefined) return;
    let active = true;
    const poll = async () => {
      try {
        const next = await request({
          type: "COMMAND",
          command: "SCAN",
          tabId,
          frameId,
        });
        if (active) {
          setSnapshot(next);
          setError("");
        }
      } catch {
        if (active) {
          setSnapshot(undefined);
          setError("Page connection lost. Reconnect, then resume explicitly.");
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 750);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tabId, frameId]);
  useEffect(() => {
    if (tabId === undefined || !chrome.tabs?.onActivated) return;
    const changed = (info: chrome.tabs.TabActiveInfo) => {
      if (info.tabId === tabId) return;
      void request({ type: "COMMAND", command: "PAUSE", tabId, frameId }).catch(
        () => undefined,
      );
      setTabId(undefined);
      setSnapshot(undefined);
      setFrames([]);
      setOrigins([]);
      setError(
        "Tab changed. Click the ApplyMate toolbar icon on the application you want to fill.",
      );
    };
    chrome.tabs.onActivated.addListener(changed);
    return () => chrome.tabs.onActivated.removeListener(changed);
  }, [tabId, frameId]);
  async function command(command: string) {
    setBusy(true);
    try {
      await request({ type: "COMMAND", command, tabId, frameId });
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function grant(origin: string) {
    try {
      const accepted = await chrome.permissions.request({ origins: [origin] });
      if (accepted) await connect();
    } catch (e) {
      setError(String(e));
    }
  }
  const ready = readiness(profile);
  const running = snapshot?.status === "running";
  return (
    <main className="panel">
      <header className="panel-header">
        <Brand />
        <IconButton
          title="Edit profile"
          onClick={() => {
            if (chrome.runtime?.openOptionsPage)
              void chrome.runtime.openOptionsPage();
            else location.href = "/options.html";
          }}
        >
          <Settings2 size={20} />
        </IconButton>
      </header>
      <div className="panel-content">
        <div className="eyebrow">APPLICATION ASSISTANT</div>
        <h1>Make your next move.</h1>
        <div className="panel-person">
          <span className="avatar small-avatar">
            {profile.personal.firstName?.[0] || "A"}
          </span>
          <div>
            <b>
              {profile.personal.firstName
                ? [profile.personal.firstName, profile.personal.lastName].join(
                    " ",
                  )
                : "Your profile"}
            </b>
            <span>
              {ready.complete === 4
                ? "Contact details ready"
                : `${ready.complete} of 4 contact details saved`}
            </span>
          </div>
          <ShieldCheck size={19} />
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="panel-section">
          <div className="list-heading">
            <h2>Current application</h2>
            <button
              className="text-button"
              disabled={connecting || running}
              onClick={() => void connect()}
            >
              {connecting ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Link size={15} />
              )}
              Reconnect
            </button>
          </div>
          <div className="platform-line">
            <Globe size={20} />
            <strong>
              {snapshot
                ? snapshot.platform === "generic"
                  ? "Other website"
                  : snapshot.platform === "smartrecruiters"
                    ? "SmartRecruiters"
                    : snapshot.platform === "workday"
                      ? "Workday"
                      : "Greenhouse"
                : "No site connected"}
            </strong>
            <span className="badge">
              {snapshot?.platform === "generic" ? "Basic fill" : "Preview"}
            </span>
          </div>
          {frames.length > 1 && (
            <label className="field">
              <span>Application frame</span>
              <select
                value={frameId}
                disabled={running}
                onChange={(e) => {
                  setSnapshot(undefined);
                  setFrameId(Number(e.target.value));
                }}
              >
                {frames.map((f) => (
                  <option key={f.frameId} value={f.frameId}>
                    {f.frameId === 0
                      ? "Main page"
                      : `Embedded form ${f.frameId}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="muted small">
            {snapshot?.scan.fields.length ?? 0} editable fields detected
          </p>
        </div>
        <div className="panel-actions">
          <button
            className="secondary"
            disabled={!snapshot || running || busy}
            onClick={() => void command("FILL")}
          >
            <FileText size={17} />
            Fill this page
          </button>
          <button
            className="primary"
            disabled={
              !snapshot || running || busy || snapshot.platform === "generic"
            }
            onClick={() => void command("START")}
          >
            <Play size={17} />
            {snapshot?.status === "paused"
              ? "Resume assisted apply"
              : "Start assisted apply"}
          </button>
        </div>
        <div className="run-status" aria-live="polite">
          <div>
            <span className={`status-dot ${running ? "live" : ""}`} />
            <b>
              {snapshot?.status === "review"
                ? "Final review"
                : running
                  ? "In progress"
                  : snapshot?.status === "paused"
                    ? "Needs your attention"
                    : snapshot?.status === "stopped"
                      ? "Stopped"
                      : "Ready when you are"}
            </b>
            {snapshot && snapshot.step > 0 && (
              <span className="step-count">{snapshot.step} filled</span>
            )}
          </div>
          <p>{snapshot?.message || "Open an application to get started."}</p>
          {(running || snapshot?.status === "paused") && (
            <div className="button-row">
              <button
                className="secondary"
                onClick={() => void command("PAUSE")}
                disabled={!running}
              >
                <Pause size={15} />
                Pause
              </button>
              <button
                className="secondary"
                onClick={() => void command("STOP")}
              >
                <Square size={14} />
                Stop
              </button>
            </div>
          )}
        </div>
        {snapshot && (
          <div className="panel-section">
            <div className="result-stats">
              <span>
                <b>{snapshot.result.filled.length}</b>Filled
              </span>
              <span>
                <b>{snapshot.result.preserved.length}</b>Preserved
              </span>
              <span>
                <b>{snapshot.result.unresolved.length}</b>To review
              </span>
            </div>
            {snapshot.result.unresolved.length > 0 && (
              <div className="review-list">
                <h2>Needs review</h2>
                {snapshot.result.unresolved.map((item, i) => (
                  <div key={`${item.label}-${i}`}>
                    <b>{item.label}</b>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {origins.length > 0 && (
          <details className="frame-access">
            <summary>Embedded form access</summary>
            {origins.map((origin) => (
              <div key={origin}>
                <span>{origin.replace("/*", "")}</span>
                <button
                  className="text-button"
                  onClick={() => void grant(origin)}
                >
                  Allow access
                  <ArrowUpRight size={14} />
                </button>
              </div>
            ))}
          </details>
        )}
        <div className="panel-footer">
          <ShieldCheck size={17} />
          <span>You review. You submit.</span>
        </div>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname.includes("sidepanel") ? <PanelApp /> : <ProfileApp />}
  </React.StrictMode>,
);
