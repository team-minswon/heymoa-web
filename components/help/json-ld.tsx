/** 검색엔진용 구조화 데이터. `<` 를 이스케이프해 본문 글자가 `</script>` 로 태그를 닫지 못하게 한다. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
