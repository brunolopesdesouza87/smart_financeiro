interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="page-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  )
}
