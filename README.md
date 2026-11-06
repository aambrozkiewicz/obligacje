# Portfel obligacji skarbowych

Dashboard w Next.js i Tailwind CSS. Działa jako statyczna strona, bez bazy danych i serwera aplikacji. Wymaga Node.js 24 LTS lub nowszej zgodnej wersji do budowania.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Otwórz [localhost:3000](http://localhost:3000). Zakupy są zapisywane w localStorage przeglądarki pod kluczem `obligacje.portfolio.v1`. Nie są wysyłane na serwer.

## Wdrożenie

```sh
pnpm build
```

Opublikuj zawartość katalogu `out/` na hostingu statycznym. Komenda budowania: `pnpm build`; katalog publikacji: `out`. Nie potrzeba bazy, zmiennych środowiskowych ani procesu Node.js na hostingu. Nie publikuj całego katalogu projektu ani starej bazy.

## Dane i kopie

Portfel jest osobny dla każdej przeglądarki i adresu strony (także localhost i docelowej domeny). Nie synchronizuje się między urządzeniami. Wyczyszczenie danych strony lub zakończenie sesji prywatnej może usunąć zakupy. Używaj przycisku „Eksportuj kopię”, aby zapisać plik JSON, i „Importuj zakupy”, aby odtworzyć go lub przenieść na inne urządzenie. Import dopisuje nowe identyfikatory zakupów, zachowując istniejące pozycje.

Jeśli masz dane w poprzedniej bazie `prisma/portfolio.db`, plik pozostaje zachowany. Aby przenieść je do nowej aplikacji:

```sh
pnpm db:export
```

Zaimportuj wygenerowany plik `portfel-backup-*.json` w aplikacji pod docelowym adresem. Eksport wymaga Node.js 24+ i używa wbudowanego modułu SQLite. Baza jest otwierana tylko do odczytu. Pliki kopii są ignorowane przez Git.

## Obliczenia

- Obsługiwane typy to TOS, COI, EDO oraz rodzinne ROS i ROD.
- Formularz uzupełnia warunki serii z listopada 2026. Przy zakupach z innych miesięcy podaj parametry z listu emisyjnego.
- Oś pokazuje dzienne szacunki brutto dla standardowej ceny zakupu 100 zł. Uwzględnia kapitalizację, coroczne wypłaty COI i limit opłaty do narosłych odsetek oraz pełną opłatę COI od drugiego okresu. Znacznik pokazuje pierwszy dzień, w którym łączne odsetki przekraczają pełną stawkę opłaty. Oś pokazuje dzień naliczania, a dostępne terminy składania dyspozycji określa list emisyjny.
- W kolejnych okresach emisji indeksowanych używamy scenariusza inflacji 2,5% plus marża. Dotyczy to również minionych okresów, dla których aplikacja nie pobiera historycznych stawek. Wycena jest szacunkiem, a oficjalne rozliczenia mogą różnić się przez warunki serii, datę rozliczenia, zaokrąglenia i podatek.

[Oferta Ministerstwa Finansów na listopad 2026](https://www.gov.pl/web/finanse/oferta-oszczednosciowych-obligacji-skarbowych--listopad-2026-r) · [Warunki przedterminowego wykupu](https://www.obligacjeskarbowe.pl/faq/)
