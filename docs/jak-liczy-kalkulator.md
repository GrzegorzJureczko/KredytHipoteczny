# Jak liczy kalkulator

Ten dokument opisuje zasady, według których kalkulator liczy ratę, harmonogram i koszt kredytu. Cała
logika jest w [`src/calculator.ts`](../src/calculator.ts) (rata i harmonogram) oraz
[`src/loanForm.ts`](../src/loanForm.ts) (koszty dodatkowe i ostrzeżenia). Zasady są pokryte testami w
[`src/calculator.test.ts`](../src/calculator.test.ts), [`src/calculator.invariants.test.ts`](../src/calculator.invariants.test.ts)
i [`src/loanForm.test.ts`](../src/loanForm.test.ts).

Wyniki są orientacyjne. Bank może stosować inne zasady, np. liczyć odsetki za rzeczywistą liczbę dni.

## Oznaczenia

| Symbol | Znaczenie |
| --- | --- |
| $K$ | kwota kredytu |
| $n$ | liczba rat (okres w latach razy 12) |
| $p$ | roczne oprocentowanie w procentach |
| $r = p / 100 / 12$ | oprocentowanie miesięczne |
| $S_{m}$ | saldo kapitału po $m$-tej racie |

Oprocentowanie to suma WIBOR i marży, zaokrąglona do czterech miejsc po przecinku.

## Odsetki

Odsetki za miesiąc to saldo na początku miesiąca razy stopa miesięczna:

$$
O_m = S_{m-1} \cdot r
$$

Kalkulator zakłada 12 równych miesięcy. Nie liczy odsetek za rzeczywistą liczbę dni.

## Rata

**Raty równe (annuitetowe).** Rata jest stała w całym okresie, o ile nic jej nie zmienia:

$$
R = K \cdot \frac{r\,(1+r)^n}{(1+r)^n - 1}
$$

Przy oprocentowaniu 0% rata to po prostu $K / n$.

**Raty malejące.** Część kapitałowa jest stała, a odsetki maleją razem z saldem:

$$
R_m = \frac{K}{n} + S_{m-1} \cdot r
$$

W obu wariantach część kapitałowa nigdy nie przekracza pozostałego salda, więc ostatnia rata może być
mniejsza od pozostałych.

## Zmiany oprocentowania

- Każda zmiana ma datę (miesiąc i rok), WIBOR i marżę. Obowiązuje od raty w tym miesiącu.
- Zmiana z datą sprzed startu kredytu obowiązuje od pierwszej raty.
- Zmiana po końcu spłaty nie wpływa na harmonogram. Formularz pokazuje wtedy ostrzeżenie.
- Gdy w jednym miesiącu jest kilka zmian, obowiązuje ostatnia z listy.
- W racie równej po każdej zmianie oprocentowania rata jest przeliczana dla salda i pozostałych miesięcy.
  W racie malejącej zmienia się tylko część odsetkowa.

## Nadpłaty

- **Kiedy działa nadpłata.** Nadpłata jest księgowana w miesiącu, w którym ją wpłacasz. Odsetki i rata
  za ten miesiąc zostają bez zmian, a niższe saldo obowiązuje od następnego miesiąca.
- **Limit.** Nadpłata nie może przekroczyć salda, które zostaje po racie kapitałowej. Nadwyżka jest
  pomijana.
- **Skrócenie okresu.** Rata zostaje bez zmian, więc kredyt kończy się wcześniej.
- **Obniżenie raty.** Po miesiącu z nadpłatą rata jest przeliczana dla nowego salda i pozostałych
  miesięcy. W racie malejącej przeliczana jest część kapitałowa: saldo podzielone przez liczbę
  pozostałych rat.
- **Nadpłaty regularne.** Mają miesiąc startu i opcjonalnie miesiąc końca (włącznie). Start sprzed
  kredytu oznacza pierwszy miesiąc. Kilka nadpłat sumuje się, a każda ma własny efekt.
- **Nadpłaty jednorazowe.** Mają jeden miesiąc i własny efekt. Data poza okresem kredytu jest
  pomijana.

## Koszty dodatkowe

Koszty dodatkowe nie wchodzą do raty ani do odsetek. Dolicza się je do całkowitego kosztu.

| Koszt | Zasada |
| --- | --- |
| Prowizja | kwota albo procent kwoty kredytu, płatna w pierwszym miesiącu |
| Notariusz, wycena, inne | kwoty płatne w pierwszym miesiącu |
| Ubezpieczenie na życie | kwota miesięczna albo procent salda na początku miesiąca, przez wskazaną liczbę miesięcy lub lat |
| Ubezpieczenie nieruchomości | kwota albo procent wartości nieruchomości lub kwoty kredytu; roczna składka jest dzielona przez 12; płatne przez cały okres kredytu |

Ubezpieczenie na życie liczone procentowo maleje razem z saldem. Pokazana w formularzu składka dotyczy
pierwszego miesiąca.

## Podsumowanie

- **Całkowity koszt** to suma rat i nadpłat oraz koszty dodatkowe.
- **Obciążenie miesięczne** to rata powiększona o średni miesięczny koszt dodatkowy, czyli koszty
  dodatkowe podzielone przez liczbę rat.
- **Struktura kosztu** dzieli całkowity koszt na kapitał, odsetki i koszty dodatkowe. Te trzy części
  zawsze sumują się do całkowitego kosztu.
- **Pierwsza rata** zamiast **Rata miesięczna** pojawia się przy ratach malejących albo gdy rata
  zmienia się o co najmniej 1 zł (zmiana oprocentowania lub obniżenie raty nadpłatą).
- **Efekt nadpłat** porównuje kredyt z nadpłatami z tym samym kredytem bez nadpłat. Zmiany
  oprocentowania są w obu wariantach takie same.

## Harmonogram

- Wiersze to kolejne miesiące od daty startu. Rok z podsumowaniem pokazuje sumy rat, kapitału, odsetek,
  nadpłat i kosztów dodatkowych oraz saldo na koniec roku.
- Wiersz z nadpłatą, startem lub końcem nadpłaty regularnej oraz ostatnią ratą ma etykietę.
- Kolumna **Saldo** to sam kapitał. Koszty dodatkowe są osobną kolumną i nie zmieniają salda.

## Zaokrąglenia

Kwoty w wierszach są zaokrąglane do groszy. Sumy w podsumowaniu liczone są z kwot niezaokrąglonych,
więc mogą różnić się od sumy wierszy o kilka groszy.

## Czego kalkulator nie uwzględnia

- liczby dni w miesiącu i dat płatności (zakłada 12 równych miesięcy),
- RRSO i innych miar kosztu rocznego,
- opłat za wcześniejszą spłatę i innych opłat zależnych od banku,
- wakacji kredytowych,
- przyszłych zmian WIBOR, poza tymi, które sam wpiszesz.

## Jak sprawdzana jest poprawność

Testy [`src/calculator.invariants.test.ts`](../src/calculator.invariants.test.ts) sprawdzają dla wielu
kombinacji kwoty, oprocentowania (w tym 0%), okresu, rodzaju raty i nadpłat, że:

- saldo nigdy nie rośnie i nie spada poniżej zera, a na końcu wynosi zero,
- suma spłaconego kapitału (rat i nadpłat) równa się kwocie kredytu,
- wiersze harmonogramu zgadzają się z podsumowaniem,
- nadpłaty nigdy nie zwiększają całkowitych odsetek ani okresu spłaty.
