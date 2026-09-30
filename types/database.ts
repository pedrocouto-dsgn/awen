// Database types for supabase-js, mirroring /supabase/migrations.
// Same shape as `supabase gen types typescript`. Regenerate or update when migrations change.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string }

type Owned = { id: string; owner_id: string } & Timestamps
type OwnedInsert = { id?: string; owner_id?: string; created_at?: string }

type ReferenceRow = Owned & {
  updated_at: string
  type: Database["public"]["Enums"]["reference_type"]
  source_kind: Database["public"]["Enums"]["source_kind"]
  source_url: string | null
  source_meta: Json | null
  title: string | null
  storage_key: string | null
  thumbnail_key: string | null
  frame_keys: string[]
  media_ready: boolean
  width: number | null
  height: number | null
  aspect_ratio: number | null
  file_size: number | null
  mime_type: string | null
  duration: number | null
  fps: number | null
  palette: Json | null
  phash: string | null
  status: Database["public"]["Enums"]["reference_status"]
  analysis_attempts: number
  analysis_error: string | null
  next_attempt_at: string | null
  analyzing_since: string | null
  analyzed_at: string | null
  reviewed_at: string | null
  ai: Json | null
  shot_type: string | null
  camera_angle: string | null
  camera_movement: string | null
  lighting: string[]
  mood: string[]
  visual_style: string | null
  texture_grain: string | null
  setting: string | null
  era: string | null
  subject: string | null
  description: string | null
  tags: string[]
  rating: number | null
  notes: string | null
  search_tsv: unknown
  embedding: string | null
}

type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>

type ReferenceInsert = Insertable<Omit<ReferenceRow, "search_tsv">, "type" | "source_kind"> & OwnedInsert

type PeopleRow = Owned & { name: string }
type ReferencePeopleRow = Owned & {
  reference_id: string
  person_id: string
  role: Database["public"]["Enums"]["person_role"]
}
type ProjectRow = Owned & {
  updated_at: string
  name: string
  description: string | null
  is_active: boolean
}
type ProjectReferenceRow = Owned & {
  project_id: string
  reference_id: string
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  z_index: number
  caption: string | null
}
type VocabularyRow = Owned & {
  category: Database["public"]["Enums"]["vocab_category"]
  term: string
  archived: boolean
  sort_order: number
}
type PromptRow = Owned & {
  updated_at: string
  prompt_text: string
  tool: string | null
  model: string | null
  type: Database["public"]["Enums"]["prompt_type"] | null
  status: Database["public"]["Enums"]["prompt_status"] | null
  params: Json | null
  origin: Database["public"]["Enums"]["prompt_origin"]
  author: string | null
  source_url: string | null
  notes: string | null
  parent_prompt_id: string | null
}
type PromptAssetRow = Owned & {
  prompt_id: string
  reference_id: string | null
  storage_key: string | null
  role: Database["public"]["Enums"]["prompt_asset_role"]
}
type PromptReferenceRow = Owned & { prompt_id: string; reference_id: string }

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

type Table<Row, Insert, Relationships extends Rel[] = []> = {
  Row: Row
  Insert: Insert
  Update: Partial<Insert>
  Relationships: Relationships
}

export type Database = {
  public: {
    Tables: {
      references: Table<ReferenceRow, ReferenceInsert>
      people: Table<PeopleRow, Insertable<PeopleRow, "name"> & OwnedInsert>
      reference_people: Table<
        ReferencePeopleRow,
        Insertable<ReferencePeopleRow, "reference_id" | "person_id" | "role"> & OwnedInsert,
        [
          {
            foreignKeyName: "reference_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_people_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "references"
            referencedColumns: ["id"]
          },
        ]
      >
      projects: Table<ProjectRow, Insertable<ProjectRow, "name"> & OwnedInsert>
      project_references: Table<
        ProjectReferenceRow,
        Insertable<ProjectReferenceRow, "project_id" | "reference_id"> & OwnedInsert,
        [
          {
            foreignKeyName: "project_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_references_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "references"
            referencedColumns: ["id"]
          },
        ]
      >
      vocabularies: Table<VocabularyRow, Insertable<VocabularyRow, "category" | "term"> & OwnedInsert>
      prompts: Table<PromptRow, Insertable<PromptRow, "prompt_text"> & OwnedInsert>
      prompt_assets: Table<PromptAssetRow, Insertable<PromptAssetRow, "prompt_id" | "role"> & OwnedInsert>
      prompt_references: Table<
        PromptReferenceRow,
        Insertable<PromptReferenceRow, "prompt_id" | "reference_id"> & OwnedInsert
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      claim_next_analysis: { Args: Record<PropertyKey, never>; Returns: ReferenceRow[] }
      queue_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          queued: number
          analyzing: number
          to_review: number
          failed: number
          next_due: string | null
        }[]
      }
      search_references: {
        Args: {
          p_query?: string | null
          p_shot_types?: string[] | null
          p_moods?: string[] | null
          p_lighting?: string[] | null
          p_aspect_min?: number | null
          p_aspect_max?: number | null
          p_person_id?: string | null
          p_project_id?: string | null
          p_type?: Database["public"]["Enums"]["reference_type"] | null
          p_source_kinds?: Database["public"]["Enums"]["source_kind"][] | null
          p_date_from?: string | null
          p_date_to?: string | null
          p_min_rating?: number | null
          p_color_lab?: number[] | null
          p_color_max_distance?: number | null
          p_status?: Database["public"]["Enums"]["reference_status"]
        }
        Returns: ReferenceRow[]
      }
      find_near_duplicates: {
        Args: { p_phash: string; p_max_distance?: number; p_exclude?: string | null }
        Returns: {
          id: string
          distance: number
          status: Database["public"]["Enums"]["reference_status"]
          thumbnail_key: string | null
          title: string | null
        }[]
      }
      set_active_project: { Args: { p_project_id: string; p_active?: boolean }; Returns: undefined }
      ensure_vocabularies: { Args: Record<PropertyKey, never>; Returns: number }
    }
    Enums: {
      reference_type: "image" | "video"
      source_kind: "upload" | "youtube" | "vimeo" | "link"
      reference_status: "pending" | "analyzing" | "approved" | "rejected" | "failed"
      person_role: "director" | "photographer" | "artist"
      vocab_category: "shot_type" | "camera_angle" | "camera_movement" | "lighting" | "mood"
      prompt_type: "text_to_video" | "image_to_video" | "image" | "edit"
      prompt_status: "worked" | "partial" | "failed"
      prompt_origin: "own" | "third_party"
      prompt_asset_role: "result" | "input"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export type Reference = Tables<"references">
export type ReferenceStatus = Enums<"reference_status">
export type VocabCategory = Enums<"vocab_category">
export type PersonRole = Enums<"person_role">
