/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  Optional,
  Output,
  ViewEncapsulation,
  ChangeDetectorRef,
} from '@angular/core';
import {DateAdapter, MAT_DATE_FORMATS, MatDateFormats} from '@angular/material/core';
import {MatCalendarCell} from './calendar-body';
import {createMissingDateImplError} from './datepicker-errors';


/**
 * An internal component used to display a single year in the datepicker.
 * @docs-private
 */
@Component({
  moduleId: module.id,
  selector: 'mat-year-view',
  templateUrl: 'year-view.html',
  exportAs: 'matYearView',
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatYearView<D> implements AfterContentInit {
  /** The date to display in this year view (everything other than the year is ignored). */
  @Input()
  get activeDate(): D { return this._activeDate; }
  set activeDate(value: D) {
    let oldActiveDate = this._activeDate;
    this._activeDate =
        this._getValidDateOrNull(this._dateAdapter.deserialize(value)) || this._dateAdapter.today();
    if (this._dateAdapter.getYear(oldActiveDate) != this._dateAdapter.getYear(this._activeDate)) {
      this._init();
    }
  }
  private _activeDate: D;

  /** The currently selected date. */
  @Input()
  get selected(): D | null { return this._selected; }
  set selected(value: D | null) {
    this._selected = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
    this._selectedMonth = this._getMonthInCurrentYear(this._selected);
  }
  private _selected: D | null;

  /** The minimum selectable date. */
  @Input()
  get minDate(): D | null { return this._minDate; }
  set minDate(value: D | null) {
    this._minDate = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
  }
  private _minDate: D | null;

  /** The maximum selectable date. */
  @Input()
  get maxDate(): D | null { return this._maxDate; }
  set maxDate(value: D | null) {
    this._maxDate = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
  }
  private _maxDate: D | null;

  /** A function used to filter which dates are selectable. */
  @Input() dateFilter: (date: D) => boolean;

  /** Emits when a new month is selected. */
  @Output() readonly selectedChange: EventEmitter<D> = new EventEmitter<D>();

  /** Grid of calendar cells representing the months of the year. */
  _months: MatCalendarCell[][];

  /** The label for this year (e.g. "2017"). */
  _yearLabel: string;

  /** The month in this year that today falls on. Null if today is in a different year. */
  _todayMonth: number | null;

  /**
   * The month in this year that the selected Date falls on.
   * Null if the selected Date is in a different year.
   */
  _selectedMonth: number | null;

  constructor(@Optional() public _dateAdapter: DateAdapter<D>,
              @Optional() @Inject(MAT_DATE_FORMATS) private _dateFormats: MatDateFormats,
              private _changeDetectorRef: ChangeDetectorRef) {
    if (!this._dateAdapter) {
      throw createMissingDateImplError('DateAdapter');
    }
    if (!this._dateFormats) {
      throw createMissingDateImplError('MAT_DATE_FORMATS');
    }

    this._activeDate = this._dateAdapter.today();
  }

  ngAfterContentInit() {
    this._init();
  }

  /** Handles when a new month is selected. */
  _monthSelected(month: number) {
    let daysInMonth = this._dateAdapter.getNumDaysInMonth(
        this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate), month, 1));
    this.selectedChange.emit(this._dateAdapter.createDate(
        this._dateAdapter.getYear(this.activeDate), month,
        Math.min(this._dateAdapter.getDate(this.activeDate), daysInMonth)));
  }

  /** Initializes this year view. */
  _init() {
    this._selectedMonth = this._getMonthInCurrentYear(this.selected);
    this._todayMonth = this._getMonthInCurrentYear(this._dateAdapter.today());
    this._yearLabel = this._dateAdapter.getYearName(this.activeDate);

    let monthNames = this._dateAdapter.getMonthNames('short');
    // First row of months only contains 5 elements so we can fit the year label on the same row.
    this._months = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]].map(row => row.map(
        month => this._createCellForMonth(month, monthNames[month])));
    this._changeDetectorRef.markForCheck();
  }

  /**
   * Gets the month in this year that the given Date falls on.
   * Returns null if the given Date is in another year.
   */
  private _getMonthInCurrentYear(date: D | null) {
    return date && this._dateAdapter.getYear(date) == this._dateAdapter.getYear(this.activeDate) ?
        this._dateAdapter.getMonth(date) : null;
  }

  /** Creates an MatCalendarCell for the given month. */
  private _createCellForMonth(month: number, monthName: string) {
    let ariaLabel = this._dateAdapter.format(
        this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate), month, 1),
        this._dateFormats.display.monthYearA11yLabel);
    return new MatCalendarCell(
        month, monthName.toLocaleUpperCase(), ariaLabel, this._shouldEnableMonth(month));
  }

  /** Whether the given month is enabled. */
  private _shouldEnableMonth(month: number) {

    const activeYear = this._dateAdapter.getYear(this.activeDate);

    if (month === undefined || month === null ||
        this._isYearAndMonthAfterMaxDate(activeYear, month) ||
        this._isYearAndMonthBeforeMinDate(activeYear, month)) {
      return false;
    }

    if (!this.dateFilter) {
      return true;
    }

    const firstOfMonth = this._dateAdapter.createDate(activeYear, month, 1);

    // If any date in the month is enabled count the month as enabled.
    for (let date = firstOfMonth; this._dateAdapter.getMonth(date) == month;
         date = this._dateAdapter.addCalendarDays(date, 1)) {
      if (this.dateFilter(date)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Tests whether the combination month/year is after this.maxDate, considering
   * just the month and year of this.maxDate
   */
  private _isYearAndMonthAfterMaxDate(year: number, month: number) {
    if (this.maxDate) {
      const maxYear = this._dateAdapter.getYear(this.maxDate);
      const maxMonth = this._dateAdapter.getMonth(this.maxDate);

      return year > maxYear || (year === maxYear && month > maxMonth);
    }

    return false;
  }

  /**
   * Tests whether the combination month/year is before this.minDate, considering
   * just the month and year of this.minDate
   */
  private _isYearAndMonthBeforeMinDate(year: number, month: number) {
    if (this.minDate) {
      const minYear = this._dateAdapter.getYear(this.minDate);
      const minMonth = this._dateAdapter.getMonth(this.minDate);

      return year < minYear || (year === minYear && month < minMonth);
    }

    return false;
  }

  /**
   * @param obj The object to check.
   * @returns The given object if it is both a date instance and valid, otherwise null.
   */
  private _getValidDateOrNull(obj: any): D | null {
    return (this._dateAdapter.isDateInstance(obj) && this._dateAdapter.isValid(obj)) ? obj : null;
  }
}
